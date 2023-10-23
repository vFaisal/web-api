import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AccountEntity } from '../../account/entities/account.entity';
import {
  generateNanoId,
  requesterInformationAsEmail,
  SignificantRequestInformation,
  unixTimestamp,
} from '../../core/utils/util';
import { PrismaService } from '../../core/providers/prisma.service';
import RedisService from '../../core/providers/redis.service';
import { AuthService } from '../auth.service';
import PhoneVerificationGlobalService from '../../core/services/phone-verification.global.service';
import { VerificationChannel } from '../../core/providers/twilio.service';
import {
  Account,
  ActivityAction,
  ActivityOperationType,
  SessionType,
} from '@prisma/client';
import MultiFactorLoginStartVerificationDto, {
  AuthenticateMFAMethods,
} from './dto/multi-factor-login-start-verification.dto';
import EmailVerificationGlobalService from '../../core/services/email-verification.global.service';
import { UAParser } from 'ua-parser-js';
import TotpGlobalService from '../../core/services/totp.global.service';
import ThrottlerService from '../../core/security/throttler.service';
import AccountActivityGlobalService from '../../core/services/account-activity.global.service';

@Injectable()
export class MultiFactorService {
  private static readonly ALLOWED_TOTP_ATTEMPTS = 10;

  private static readonly FAILED_ATTEMPTS_LIMIT = 20;
  private static readonly FAILED_ATTEMPTS_TTL = 45 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly kv: RedisService,
    private readonly phoneVerificationService: PhoneVerificationGlobalService,
    private readonly emailVerificationService: EmailVerificationGlobalService,
    private readonly authService: AuthService,
    private readonly totpService: TotpGlobalService,
    private readonly accountActivityService: AccountActivityGlobalService,
    private readonly throttler: ThrottlerService,
  ) {}

  private async createCredentials(
    account: Account,
    token: string,
    significantRequestInformation: SignificantRequestInformation,
    sessionType: SessionType,
  ) {
    const multiFactorLogin = await this.kv.del('MFALogin:' + token);
    if (multiFactorLogin === 0)
      throw new BadRequestException({
        code: 'mfa_token_no_longer_valid',
        message:
          'The Multi-Factor Verification session is no longer valid. For security purposes, please log in again and initiate a new verification process.',
      });

    return this.authService.createCredentials(
      account,
      significantRequestInformation,
      sessionType,
      true,
    );
  }

  public getEmailVerificationMessage(
    safeAccountData: AccountEntity,
    significantRequestInformation: SignificantRequestInformation,
  ) {
    const userAgentParsed = new UAParser(
      significantRequestInformation.userAgent,
    );
    const os = userAgentParsed.getOS().name ?? '';
    const browser = userAgentParsed.getBrowser().name ?? '';

    return {
      subject:
        'Action Required: Multi-Factor Authentication (MFA) for Secure Login',
      description:
        `Dear ${safeAccountData.raw.account.displayName},\n` +
        '\n' +
        'We hope this email finds you well. We have detected an intent to log in to your account from a new device. As part of our commitment to ensuring the utmost security for your account, Multi-Factor Authentication (MFA) has been enabled and configured by you.\n' +
        '\n' +
        'Login Attempt Details:\n' +
        requesterInformationAsEmail(significantRequestInformation) +
        '\n' +
        'To proceed with the login and verify your identity, please use the following 6-digit MFA verification code: ######' +
        '\n' +
        'Kindly ensure the confidentiality of this code and refrain from sharing it with anyone. We, as a service provider, will never ask for your MFA code or any other sensitive information.',
    };
  }

  public async startVerification(
    token: string,
    sri: SignificantRequestInformation,
    data: MultiFactorLoginStartVerificationDto,
  ) {
    const multiFactorLogin = await this.kv.get<MultiFactorLogin>(
      `MFALogin:${token}`,
    );
    if (!multiFactorLogin)
      throw new BadRequestException({
        code: 'invalid_mfa_login_token',
        message:
          'The provided Multi-Factor Authentication (MFA) token is invalid. Please enter a valid token and try again.',
      });

    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: BigInt(multiFactorLogin.accountId),
      },
    });

    const safeAccountData = new AccountEntity(account);

    if (safeAccountData.isLoginByMFALocked())
      throw new BadRequestException({
        code: 'account_temporarily_locked',
        message:
          'Due to excessive failed login attempts, your account is temporarily locked. It will be automatically unlocked within 2 to 24 hours.',
      });

    if (['voice', 'sms', 'whatsapp'].includes(data.method)) {
      if (
        (!safeAccountData.isMFASMSEnabled() &&
          ['voice', 'sms'].includes(data.method)) ||
        (!safeAccountData.isMFAWhatsappEnabled() && data.method === 'whatsapp')
      )
        throw new BadRequestException({
          code: 'mfa_method_not_available',
          message:
            'The requested Multi-Factor Authentication method is not available or cannot be used for the current account. Please try another available MFA method.',
        });

      if (data.phoneNumber !== safeAccountData.phone.full) {
        await this.handleThrottler(account,sri, 2);
        throw new BadRequestException({
          code: 'mfa_phone_number_not_matches',
          message:
            'The provided phone number does not match the registered phone number for this account.',
        });
      }

      const phoneVerification = await this.phoneVerificationService.start(
        safeAccountData.raw.account.id,
        {
          number: safeAccountData.phone.number,
          countryCallingCode: safeAccountData.phone.prefix.replace('+', ''),
        },
        data.method === 'voice'
          ? VerificationChannel.CALL
          : data.method === 'whatsapp'
          ? VerificationChannel.WHATSAPP
          : VerificationChannel.SMS,
        'two-factor',
      );
      const loginVerificationToken = generateNanoId();
      await this.kv.setex<MultiFactorVerification>(
        `MFALoginVerification:${loginVerificationToken}`,
        AuthService.EXPIRATION.MFA_VERIFY_TOKEN,
        {
          accountId: String(safeAccountData.raw.account.id),
          verificationToken: phoneVerification.token,
          method: data.method,
          ref: token,
          sessionType: multiFactorLogin.sessionType,
        },
      );

      return {
        method: data.method,
        phone: safeAccountData.getPhoneWithHide(),
        token: loginVerificationToken,
        expires: unixTimestamp(AuthService.EXPIRATION.MFA_VERIFY_TOKEN),
      };
    } else if (data.method === 'email') {
      if (!safeAccountData.isMFAEmailEnabled())
        throw new BadRequestException({
          code: 'mfa_method_not_available',
          message:
            'The requested Multi-Factor Authentication method is not available or cannot be used for the current account. Please try another available MFA method.',
        });

      const emailVerificationToken = await this.emailVerificationService.start(
        safeAccountData.email,
        {
          type: 'account',
          identifier: safeAccountData.raw.account.id,
        },
        'mfa_login',
        this.getEmailVerificationMessage(
          safeAccountData,
          sri,
        ),
      );

      const loginVerificationToken = generateNanoId();
      await this.kv.setex<MultiFactorVerification>(
        `MFALoginVerification:${loginVerificationToken}`,
        AuthService.EXPIRATION.MFA_VERIFY_TOKEN,
        {
          accountId: String(safeAccountData.raw.account.id),
          verificationToken: emailVerificationToken,
          method: data.method,
          ref: token,
          sessionType: multiFactorLogin.sessionType,
        },
      );

      return {
        method: data.method,
        token: loginVerificationToken,
        expires: unixTimestamp(AuthService.EXPIRATION.MFA_VERIFY_TOKEN),
      };
    }

    throw new ServiceUnavailableException();
  }

  public async resend(
    data: MultiFactorLoginStartVerificationDto,
    token: string,
    significantRequestInformation: SignificantRequestInformation,
  ) {
    const multiFactorVerification = await this.kv.get<MultiFactorVerification>(
      `MFALoginVerification:${token}`,
    );
    if (!multiFactorVerification)
      throw new BadRequestException({
        code: 'invalid_mfa_verification_token',
        message:
          'The provided Multi-Factor Authentication (MFA) verification token is invalid. Please enter a valid token and try again.',
      });

    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: BigInt(multiFactorVerification.accountId),
      },
    });

    const safeAccountData = new AccountEntity(account);

    if (safeAccountData.isLoginByMFALocked())
      throw new BadRequestException({
        code: 'account_temporarily_locked',
        message:
          'Due to excessive failed login attempts, your account is temporarily locked. It will be automatically unlocked within 2 to 24 hours.',
      });

    if (
      (['sms', 'voice'].includes(data.method) &&
        !safeAccountData.isMFASMSEnabled()) ||
      (data.method === 'whatsapp' && !safeAccountData.isMFAWhatsappEnabled()) ||
      (data.method === 'email' && !safeAccountData.isMFAEmailEnabled())
    )
      throw new BadRequestException({
        code: 'mfa_method_no_longer_available',
        message:
          'The Multi-Factor method is no longer available for this account. For security purposes, please initiate a new verification process.',
      });

    if (['sms', 'whatsapp', 'voice'].includes(multiFactorVerification.method)) {
      const fullNumber = '+' + account.phoneCountryCode + account.phoneNumber;

      return this.phoneVerificationService.resend(
        fullNumber,
        account.id,
        multiFactorVerification.verificationToken,
        data.method === 'voice'
          ? VerificationChannel.CALL
          : data.method === 'whatsapp'
          ? VerificationChannel.WHATSAPP
          : VerificationChannel.SMS,
        'two-factor',
      );
    } else if (multiFactorVerification.method === 'email') {
      return this.emailVerificationService.resend(
        token,
        account.email,
        'mfa_login',
        this.getEmailVerificationMessage(
          safeAccountData,
          significantRequestInformation,
        ),
        account.id,
      );
    }

    throw new BadRequestException({
      code: 'mfa_method_not_allowed',
      message:
        'You are not authorized to use the requested MFA method for this endpoint.',
    });
  }

  public async verifyTOTP(
    token: string,
    code: string,
    sri: SignificantRequestInformation,
  ) {
    const multiFactorLogin = await this.kv.get<MultiFactorLogin>(
      `MFALogin:${token}`,
    );
    if (!multiFactorLogin)
      throw new BadRequestException({
        code: 'invalid_mfa_login_token',
        message:
          'The provided Multi-Factor Authentication (MFA) token is invalid. Please enter a valid token and try again.',
      });

    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: BigInt(multiFactorLogin.accountId),
      },
    });

    const safeAccountData = new AccountEntity(account);

    if (safeAccountData.isLoginByMFALocked())
      throw new BadRequestException({
        code: 'account_temporarily_locked',
        message:
          'Due to excessive failed login attempts, your account is temporarily locked. It will be automatically unlocked within 2 to 24 hours.',
      });

    if (!safeAccountData.isMFAAppEnabled())
      throw new BadRequestException({
        code: 'mfa_method_not_available',
        message:
          'The requested Multi-Factor Authentication method is not available or cannot be used for the current account.',
      });

    if (
      multiFactorLogin.totpAttempts >= MultiFactorService.ALLOWED_TOTP_ATTEMPTS
    )
      throw new HttpException(
        {
          code: 'mfa_rate_limit_exceeded',
          message:
            'You have exceeded the maximum number of attempts for MFA login using TOTP.',
        },
        429,
      );

    await this.kv.setex<MultiFactorLogin>(
      `MFALogin:${token}`,
      unixTimestamp(AuthService.EXPIRATION.MFA_VERIFY_TOKEN),
      {
        accountId: String(safeAccountData.raw.account.id),
        totpAttempts: multiFactorLogin.totpAttempts + 1,
        sessionType: multiFactorLogin.sessionType,
      },
    );

    const generatedCode = this.totpService.generateCode(
      this.totpService.createSecret(account.mfaAppKey),
    );

    if (generatedCode !== code) {
      await this.handleThrottler(account,sri, 1);
      throw new BadRequestException({
        code: 'invalid_totp_code',
        message:
          "The TOTP code you entered is invalid. Make sure you're using the correct code from your authenticator app.",
      });
    }

    await this.kv.del('failedMultiFactorLoginAttempts:' + account.id);

    return this.createCredentials(
      account,
      token,
      sri,
      multiFactorLogin.sessionType,
    );
  }

  public async verify(
    token: string,
    code: string,
    sri: SignificantRequestInformation,
  ) {
    const multiFactorVerification = await this.kv.get<MultiFactorVerification>(
      `MFALoginVerification:${token}`,
    );
    if (!multiFactorVerification)
      throw new BadRequestException({
        code: 'invalid_mfa_verification_token',
        message:
          'The provided Multi-Factor Authentication (MFA) verification token is invalid. Please enter a valid token and try again.',
      });

    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: BigInt(multiFactorVerification.accountId),
      },
    });

    const safeAccountData = new AccountEntity(account);

    if (safeAccountData.isLoginByMFALocked())
      throw new BadRequestException({
        code: 'account_temporarily_locked',
        message:
          'Due to excessive failed login attempts, your account is temporarily locked. It will be automatically unlocked within 2 to 24 hours.',
      });

    if (
      (['sms', 'voice'].includes(multiFactorVerification.method) &&
        !safeAccountData.isMFASMSEnabled()) ||
      (multiFactorVerification.method === 'whatsapp' &&
        !safeAccountData.isMFAWhatsappEnabled()) ||
      (multiFactorVerification.method === 'email' &&
        !safeAccountData.isMFAEmailEnabled())
    )
      throw new BadRequestException({
        code: 'mfa_method_no_longer_available',
        message:
          'The Multi-Factor method is no longer available for this account. For security purposes, please initiate a new verification process.',
      });

    if (['sms', 'whatsapp', 'voice'].includes(multiFactorVerification.method)) {
      const fullNumber = '+' + account.phoneCountryCode + account.phoneNumber;
      await this.phoneVerificationService
        .verify(
          fullNumber,
          account.id,
          multiFactorVerification.verificationToken,
          code,
          'two-factor',
        )
        .catch(async (err) => {
          if (
            err instanceof HttpException &&
            (err.getResponse() as any)?.code ===
              'invalid_phone_verification_code'
          )
            await this.handleThrottler(account,sri, 2);
          throw err;
        });

      await this.kv.del('failedMultiFactorLoginAttempts:' + account.id);

      return this.createCredentials(
        account,
        multiFactorVerification.ref,
        sri,
        multiFactorVerification.sessionType,
      );
    } else if (multiFactorVerification.method === 'email') {
      await this.emailVerificationService
        .verify(
          code,
          multiFactorVerification.verificationToken,
          account.email,
          'mfa_login',
          account.id,
        )
        .catch(async (err) => {
          if (
            err instanceof HttpException &&
            (err.getResponse() as any)?.code ===
              'invalid_email_verification_code'
          )
            await this.handleThrottler(account,sri, 2);
          throw err;
        });

      await this.kv.del('failedMultiFactorLoginAttempts:' + account.id);

      return this.createCredentials(
        account,
        multiFactorVerification.ref,
        sri,
        multiFactorVerification.sessionType,
      );
    }

    throw new BadRequestException({
      code: 'mfa_method_not_allowed',
      message:
        'You are not authorized to use the requested MFA method for this endpoint.',
    });
  }

  public async handleThrottler(
    account: Account,
    sri: SignificantRequestInformation,
    increment = 1,
  ) {
    const cacheKey = 'failedMultiFactorLoginAttempts:' + account.id;
    const failedAttempts = await this.kv.get<number>(cacheKey);
    if (failedAttempts >= MultiFactorService.FAILED_ATTEMPTS_LIMIT) {
      const unlockedTime = unixTimestamp(
        (account.mfaLoginUnlocked?.getTime() > unixTimestamp(-7 * 24 * 3600)
          ? 18
          : 6) *
          60 *
          60,
        'DATE',
      );
      await this.prisma.account.updateMany({
        where: {
          id: account.id,
        },
        data: {
          mfaLoginUnlocked: unlockedTime,
        },
      });

      this.accountActivityService.create(
        account.id,
        sri,
        ActivityOperationType.NOTIFY,
        ActivityAction.ACCOUNT_MFA_LOCKED,
        [
          {
            key: "mfaUnlockTimestamp",
            value: String(unlockedTime.getTime())
          }
        ]
      );
    }
    await this.kv.setex(
      cacheKey,
      MultiFactorService.FAILED_ATTEMPTS_TTL,
      failedAttempts + increment,
    );
  }
}

interface MultiFactorVerification {
  method: AuthenticateMFAMethods;
  sessionType: SessionType;
  verificationToken: string;
  ref: string;
  accountId: string;
}

export interface MultiFactorLogin {
  totpAttempts: number;
  accountId: string;
  sessionType: SessionType;
}
