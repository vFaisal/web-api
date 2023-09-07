import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/providers/prisma.service';
import PasswordValidationService from '../../../core/services/password-validation.service';
import EmailVerificationService from '../../../core/services/email-verification.service';
import PhoneVerificationService from '../../../core/services/phone-verification.service';
import TotpService from '../../../core/services/totp.service';
import SessionService from '../../../core/services/session.service';
import RedisService from '../../../core/providers/redis.service';
import SessionEntity from '../../entities/session.entity';
import { AccountEntity } from '../../../account/entities/account.entity';
import { AccessLevel } from '../../../core/security/authorization.decorator';
import {
  requesterInformationAsEmail,
  SignificantRequestInformation,
  unixTimestamp,
} from '../../../core/utils/util';
import { VerificationChannel } from '../../../core/providers/twilio.service';
import { AuthService } from '../../auth.service';

@Injectable()
export class AccessService {
  private static readonly ATTEMPTS_VALIDATE_TOTP_LIMIT = 15;
  private static readonly ATTEMPTS_VALIDATE_TOTP_TTL = 15 * 60;
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordValidation: PasswordValidationService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly phoneVerificationService: PhoneVerificationService,
    private readonly totpService: TotpService,
    private readonly sessionService: SessionService,
    private readonly kv: RedisService,
  ) {}

  public async availableRequestAccessLevelMethods(session: SessionEntity) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    const safeAccountData = new AccountEntity(account);
    return {
      current: {
        level: session.getAccessLevel(),
      },
      availableMethods: {
        email: true,
        password: !safeAccountData.isPasswordLess(),
        sms: safeAccountData.verified.phone,
        app: safeAccountData.isMFAAppEnabled(),
      },
    };
  }

  public async requestMediumAccessLevelByPassword(
    session: SessionEntity,
    password: string,
  ) {
    if (session.getAccessLevel() >= AccessLevel.MEDIUM)
      throw new BadRequestException({
        code: 'redundant_access_request',
        message:
          'The current session already holds access to the specified resource. No further access request is required.',
      });
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    await this.passwordValidation.validatePasswordIfRateLimitedRevokeSession(
      session,
      account,
      password,
    );

    session.setAccessLevel(AccessLevel.MEDIUM);
    await this.grantAccessLevel(session);
  }

  public getEmailMessage(
    safeAccountDate: AccountEntity,
    sri: SignificantRequestInformation,
  ) {
    return {
      subject:
        'Email Verification Code Required for Account Settings Modification',
      description:
        `Hello ${safeAccountDate.displayName ?? ''},\n` +
        "We've received a request to modify your account settings from the active session.\n" +
        'To proceed and ensure the security of your account, please use the 6-digit verification code provided below:\n' +
        'Verification Code: ###### (This code is only valid for 10 minutes.)\n\n' +
        'Requester Information:\n' +
        requesterInformationAsEmail(sri),
    };
  }

  public async requestMediumAccessLevelByEmail(
    session: SessionEntity,
    sri: SignificantRequestInformation,
  ) {
    if (session.getAccessLevel() >= AccessLevel.MEDIUM)
      throw new BadRequestException({
        code: 'redundant_access_request',
        message:
          'The current session already holds access to the specified resource. No further access request is required.',
      });
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    const safeAccountData = new AccountEntity(account);
    const verificationToken = await this.emailVerificationService.start(
      account.email,
      {
        type: 'account',
        identifier: account.id,
      },
      'generateMediumAccessLevel',
      this.getEmailMessage(safeAccountData, sri),
    );

    return {
      token: verificationToken,
      expires: unixTimestamp(EmailVerificationService.VERIFICATION_EXPIRATION),
    };
  }

  public async verifyRequestMediumAccessByEmail(
    session: SessionEntity,
    code: string,
    token: string,
  ) {
    if (session.getAccessLevel() >= AccessLevel.MEDIUM)
      throw new BadRequestException({
        code: 'redundant_access_request',
        message:
          'The current session already holds access to the specified resource. No further access request is required.',
      });
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    await this.emailVerificationService.verify(
      code,
      token,
      account.email,
      'generateMediumAccessLevel',
      session.getAccount().id,
    );

    session.setAccessLevel(AccessLevel.MEDIUM);
    await this.grantAccessLevel(session);
  }

  public async resendRequestMediumAccessLevelByEmail(
    session: SessionEntity,
    sri: SignificantRequestInformation,
    token: string,
  ) {
    if (session.getAccessLevel() >= AccessLevel.MEDIUM)
      throw new BadRequestException({
        code: 'redundant_access_request',
        message:
          'The current session already holds access to the specified resource. No further access request is required.',
      });
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    const safeAccountData = new AccountEntity(account);
    return this.emailVerificationService.resend(
      token,
      account.email,
      'generateMediumAccessLevel',
      this.getEmailMessage(safeAccountData, sri),
      session.getAccount().id,
    );
  }

  public async requestMediumAccessLevelByPhone(
    session: SessionEntity,
    channel: VerificationChannel,
  ) {
    if (session.getAccessLevel() >= AccessLevel.MEDIUM)
      throw new BadRequestException({
        code: 'redundant_access_request',
        message:
          'The current session already holds access to the specified resource. No further access request is required.',
      });
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    const safeAccountData = new AccountEntity(account);
    if (!safeAccountData.verified.phone)
      throw new BadRequestException({
        code: 'account_phone_registered_required',
        message:
          'A registered phone number is required to perform this action. Please add and verify a phone number on your account.',
      });

    return await this.phoneVerificationService.start(
      session.getAccount().id,
      {
        number: account.phoneCountryCode,
        countryCallingCode: account.phoneNumber,
      },
      channel,
      'generateMediumAccessLevel',
    );
  }

  public async resendRequestMediumAccessLevelByPhone(
    session: SessionEntity,
    token: string,
    channel: VerificationChannel,
  ) {
    if (session.getAccessLevel() >= AccessLevel.MEDIUM)
      throw new BadRequestException({
        code: 'redundant_access_request',
        message:
          'The current session already holds access to the specified resource. No further access request is required.',
      });
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    const safeAccountData = new AccountEntity(account);
    if (!safeAccountData.verified.phone)
      throw new BadRequestException({
        code: 'account_phone_registered_required',
        message:
          'A registered phone number is required to perform this action. Please add and verify a phone number on your account.',
      });

    return await this.phoneVerificationService.resend(
      safeAccountData.phone.full,
      account.id,
      token,
      channel,
      'generateMediumAccessLevel',
    );
  }

  public async verifyRequestMediumAccessLevelByPhone(
    session: SessionEntity,
    code: string,
    token: string,
  ) {
    if (session.getAccessLevel() >= AccessLevel.MEDIUM)
      throw new BadRequestException({
        code: 'redundant_access_request',
        message:
          'The current session already holds access to the specified resource. No further access request is required.',
      });
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    const safeAccountData = new AccountEntity(account);
    if (!safeAccountData.verified.phone)
      throw new BadRequestException({
        code: 'account_phone_registered_required',
        message:
          'A registered phone number is required to perform this action. Please add and verify a phone number on your account.',
      });

    await this.phoneVerificationService.verify(
      safeAccountData.phone.full,
      account.id,
      token,
      code,
      'generateMediumAccessLevel',
    );

    session.setAccessLevel(AccessLevel.MEDIUM);
    await this.grantAccessLevel(session);
  }

  public async verifyRequestMediumAccessLevelByTOTP(
    session: SessionEntity,
    code: string,
  ) {
    if (session.getAccessLevel() >= AccessLevel.MEDIUM)
      throw new BadRequestException({
        code: 'redundant_access_request',
        message:
          'The current session already holds access to the specified resource. No further access request is required.',
      });
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    const safeAccountData = new AccountEntity(account);
    if (!safeAccountData.isMFAAppEnabled())
      throw new BadRequestException({
        code: 'account_totp_registered_required',
        message:
          'A registered Time-Based One-Time Password (TOTP) is required to perform this action. Please set up and verify TOTP for your account.',
      });

    const generatedCode = this.totpService.generateCode(
      this.totpService.createSecret(account.mfaAppKey),
    );

    const cacheKey = `validateTOTPAttempts:session:${session.getPrimaryPublicId()}`;

    const attempts = (await this.kv.get<number>(cacheKey)) ?? 0;
    if (attempts >= AccessService.ATTEMPTS_VALIDATE_TOTP_LIMIT) {
      await this.sessionService.revoke(
        session.getPrimaryPublicId(),
        account.id,
        session.getSecondaryPublicId(),
      );
      throw new UnauthorizedException({
        code: 'session_revoked_due_to_attempts',
        message:
          'Your session has been revoked due to too many failed TOTP validation attempts. Re-authenticate to access your account.',
      });
    }

    if (generatedCode !== code) {
      await this.kv.setex<number>(
        cacheKey,
        AccessService.ATTEMPTS_VALIDATE_TOTP_TTL,
        attempts + 1,
      );
      throw new BadRequestException({
        code: 'invalid_totp_code',
        message:
          "The TOTP code you entered is invalid. Make sure you're using the correct code from your authenticator app.",
      });
    }
    if (attempts <= 0) await this.kv.del(cacheKey);

    session.setAccessLevel(AccessLevel.MEDIUM);
    await this.grantAccessLevel(session);
  }

  public async grantAccessLevel(session: SessionEntity) {
    await this.kv.setex(
      `session:${session.getSecondaryPublicId()}`,
      AuthService.EXPIRATION.ACCESS_TOKEN -
        Math.max(
          Math.round(unixTimestamp() - session.getCreatedTimestampAt()),
          180,
        ),
      session,
    );
  }
}
