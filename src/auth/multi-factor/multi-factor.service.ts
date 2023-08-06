import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AccountEntity } from '../../account/entities/account.entity';
import {
  generateNanoId,
  SignificantRequestInformation,
  unixTimestamp,
} from '../../core/utils/util';
import { PrismaService } from '../../core/providers/prisma.service';
import RedisService from '../../core/providers/redis.service';
import { AuthService } from '../auth.service';
import PhoneVerificationService from '../../core/services/phone-verification.service';
import { VerificationChannel } from '../../core/providers/twilio.service';
import { Account, SessionType } from '@prisma/client';
import MultiFactorLoginStartVerificationDto, {
  AuthenticateMFAMethods,
} from './dto/multi-factor-login-start-verification.dto';

@Injectable()
export class MultiFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kv: RedisService,
    private readonly phoneVerificationService: PhoneVerificationService,
    private readonly authService: AuthService,
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

  public async startVerification(
    token: string,
    data: MultiFactorLoginStartVerificationDto,
  ) {
    const mfa = await this.kv.get<MultiFactorLogin>(`MFALogin:${token}`);
    if (!mfa)
      throw new BadRequestException({
        code: 'invalid_mfa_token',
        message:
          'The provided Multi-Factor Authentication (MFA) token is invalid. Please enter a valid token and try again.',
      });
    console.log(mfa);
    if (mfa.uses >= 6)
      throw new HttpException(
        {
          code: 'too_many_attempt_mfa_token',
          message:
            'You have exceeded the maximum allowed usage of the token for generating verification codes. For security purposes, a re-login is necessary to obtain a fresh token.',
        },
        429,
      );
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: BigInt(mfa.accountId),
      },
    });

    const safeAccountData = new AccountEntity(account);

    await this.kv.setex<MultiFactorLogin>(
      `MFALogin:${token}`,
      unixTimestamp(AuthService.EXPIRATION.MFA_VERIFY_TOKEN),
      {
        accountId: String(safeAccountData.raw.account.id),
        uses: mfa.uses + 1,
        sessionType: mfa.sessionType,
      },
    );

    if (['voice', 'sms', 'whatsapp'].includes(data.method)) {
      if (
        !safeAccountData.isMFASMSEnabled() &&
        ['voice', 'sms'].includes(data.method)
      )
        throw new BadRequestException({
          code: 'mfa_method_not_available',
          message:
            'The requested Multi-Factor Authentication method is not available or cannot be used for the current user. Please try another available MFA method.',
        });

      if (!safeAccountData.isMFASMSEnabled() && data.method === 'whatsapp')
        throw new BadRequestException({
          code: 'mfa_method_not_available',
          message:
            'The requested Multi-Factor Authentication method is not available or cannot be used for the current user. Please try another available MFA method.',
        });

      if (data.phoneNumber !== safeAccountData.phone.full)
        throw new BadRequestException({
          code: 'mfa_phone_number_not_matches',
          message:
            'The provided phone number does not match the registered phone number for this account. Please verify the phone number and try again.',
        });

      const phoneVerificationToken = await this.phoneVerificationService.start(
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
      );
      const verificationToken = generateNanoId();
      await this.kv.setex<MultiFactorVerification>(
        `MFALoginVerification:${verificationToken}`,
        unixTimestamp(AuthService.EXPIRATION.MFA_VERIFY_TOKEN),
        {
          accountId: String(safeAccountData.raw.account.id),
          phoneVerificationToken: phoneVerificationToken,
          method: data.method,
          ref: token,
          sessionType: mfa.sessionType,
        },
      );

      return {
        method: data.method,
        phone: safeAccountData.getPhoneWithHide(),
        token: verificationToken,
        expires: unixTimestamp(AuthService.EXPIRATION.MFA_VERIFY_TOKEN),
      };
    }

    throw new ServiceUnavailableException();
  }

  public async verify(
    token: string,
    code: string,
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

    if (['sms', 'whatsapp', 'voice'].includes(multiFactorVerification.method)) {
      const account = await this.prisma.account.findUniqueOrThrow({
        where: {
          id: BigInt(multiFactorVerification.accountId),
        },
      });
      const fullNumber = '+' + account.phoneCountryCode + account.phoneNumber;
      await this.phoneVerificationService.verify(
        fullNumber,
        account.id,
        multiFactorVerification.phoneVerificationToken,
        code,
      );

      return this.createCredentials(
        account,
        multiFactorVerification.ref,
        significantRequestInformation,
        multiFactorVerification.sessionType,
      );
    }
  }
}

interface MultiFactorVerification {
  method: AuthenticateMFAMethods;
  sessionType: SessionType;
  phoneVerificationToken: string;
  ref: string;
  accountId: string;
}

export interface MultiFactorLogin {
  uses: number;
  accountId: string;
  sessionType: SessionType;
}
