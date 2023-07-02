import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import SessionEntity from '../../auth/entities/session.entity';
import { AccountService } from '../account.service';
import RedisService from '../../core/providers/redis.service';
import {
  base32Decode,
  base32Encode,
  generateNanoId,
  unixTimestamp,
} from '../../core/utils/util';
import { PrismaService } from '../../core/providers/prisma.service';
import PhoneVerificationService from '../../core/services/phone-verification.service';
import TwilioService from '../../core/providers/twilio.service';

@Injectable()
export class MultiFactorService {
  //TOTP Configuration
  private static readonly ALGORITHM = 'sha1';
  private static readonly ISSUER = 'faisal.gg';
  public static readonly DIGITS = 6;
  private static readonly PERIOD = 30;
  private static readonly VERIFICATION_EXPIRES = 60 * 10; //Seconds (10 Min);

  constructor(
    private readonly config: ConfigService,
    private readonly accountService: AccountService,
    private readonly kv: RedisService,
    private readonly prisma: PrismaService,
    private readonly phoneVerificationService: PhoneVerificationService,
    private readonly twilioService: TwilioService,
  ) {}

  /*  public async configureSMS(session: SessionEntity) {
      const account = await this.accountService.getSafeAccountData(
        session.getAccount().id,
      );
      if (account.twoFactor.methods.includes('SMS'))
        throw new BadRequestException({
          code: '2fa_sms_already_enabled',
          message:
            'Two-Factor Authentication (2FA) using SMS verification is already enabled for this account. No further action is required.',
        });
  
      const fullPhoneNumber =
        '+' + String(phoneCountryCode) + String(phoneNumber);
      const phoneNumberIsValid = await this.twilioService.validatePhoneNumber(
        fullPhoneNumber,
      );
      if (!phoneNumberIsValid)
        throw new BadRequestException({
          code: 'invalid_phone_number',
          message:
            'The phone number provided is invalid. Please ensure you have entered a valid phone number and try again.',
        });
  
      const phoneNumberLinked = await this.prisma.account.findFirst({
        where: {
          phoneNumber: phoneNumber,
          phoneCountryCode: phoneCountryCode,
        },
      });
      if (phoneNumberLinked)
        throw new BadRequestException({
          code: 'phone_number_already_linked',
          message:
            'The phone number provided is already associated with another account. Please use a different phone number or contact support for further assistance.',
        });
  
      const verificationToken = await this.phoneVerificationService.start(
        account.raw.account.id,
        fullPhoneNumber,
        'sms',
      );
  
      await this.kv.setex(
        `sms_2fa_configuration:${account.id}`,
        MultiFactorService.VERIFICATION_EXPIRES,
        {
          token: verificationToken,
        },
      );
  
      return {
        phone: {
          countryCode: phoneCountryCode,
          number: phoneNumber,
        },
        expires: unixTimestamp(MultiFactorService.VERIFICATION_EXPIRES),
      };
    }*/

  public async configureTOTP(session: SessionEntity) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );
    if (account.twoFactor.methods.includes('APP'))
      throw new BadRequestException({
        code: '2fa_authentication_app_already_enabled',
        message:
          'The Two-Factor Authentication (2FA) authentication app is already enabled for this account. Please disable the current 2FA app before attempting to enable a new one.',
      });

    const key = generateNanoId(16);
    const secret = this.createTOTPSecret(key);

    await this.kv.setex(
      `totp_2fa_configuration:${account.id}`,
      MultiFactorService.VERIFICATION_EXPIRES,
      key,
    );

    return {
      uri: this.createTOTPUri(secret, account.email),
      expires: unixTimestamp(MultiFactorService.VERIFICATION_EXPIRES),
    };
  }

  public async verifyTOTP(session: SessionEntity, digit: string) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );
    if (account.twoFactor.methods.includes('APP'))
      throw new BadRequestException({
        code: '2fa_authentication_app_already_enabled',
        message:
          'The Two-Factor Authentication (2FA) authentication app is already enabled for this account. Please disable the current 2FA app before attempting to enable a new one.',
      });

    const key: string = await this.kv.get(
      `totp_2fa_configuration:${account.id}`,
    );
    if (!key)
      throw new BadRequestException({
        code: '2fa_authentication_app_new_configuration_required',
        message:
          'A new configuration for the Two-Factor Authentication (2FA) authentication app is required. Please generate a new configuration to enable the 2FA app.',
      });

    const generatedDigit = this.generateTOTP(this.createTOTPSecret(key));

    if (generatedDigit !== digit)
      throw new BadRequestException({
        code: '2fa_authentication_app_configuration_invalid_code',
        message:
          'The provided configuration code for the Two-Factor Authentication (2FA) authentication app is incorrect. Please ensure you have entered the correct code and try again.',
      });

    await this.kv.del(`totp_2fa_configuration:${account.id}`);

    await this.prisma.account.updateMany({
      data: {
        mfaAppKey: key,
      },
      where: {
        id: account.raw.account.id,
      },
    });
  }

  public async disableTOTP(session: SessionEntity) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );
    if (!account.twoFactor.methods.includes('APP'))
      throw new BadRequestException({
        code: '2fa_authentication_app_already_disabled',
        message:
          'The Two-Factor Authentication (2FA) authentication app is already disabled for this account.',
      });
  }

  private createTOTPSecret(key: string) {
    return base32Encode(
      createHmac('sha256', this.config.getOrThrow('APPLICATION_TOTP_KEY'))
        .update(key)
        .digest()
        .subarray(0, 20),
    );
  }

  private generateTOTP(secret: string) {
    const counter = Math.floor(
      Math.floor(Date.now() / 1000) / MultiFactorService.PERIOD,
    );

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(
      BigInt(
        Math.floor(Math.floor(Date.now() / 1000) / MultiFactorService.PERIOD),
      ),
      0,
    );

    const buffer = createHmac('sha1', base32Decode(secret))
      .update(counterBuffer)
      .digest();
    const offset = buffer[buffer.length - 1] & 0x0f;
    const otp =
      (buffer.readUInt32BE(offset) & 0x7fffffff) %
      10 ** MultiFactorService.DIGITS;

    return otp.toString().padStart(MultiFactorService.DIGITS, '0');
  }

  private createTOTPUri(secret: string, displayName: string) {
    const params = new URLSearchParams({
      secret,
      issuer: MultiFactorService.ISSUER,
      period: String(MultiFactorService.PERIOD),
      digits: String(MultiFactorService.DIGITS),
      algorithm: MultiFactorService.ALGORITHM,
    });
    return `otpauth://totp/${
      MultiFactorService.ISSUER
    }:${displayName}?${params.toString()}`;
  }
}
