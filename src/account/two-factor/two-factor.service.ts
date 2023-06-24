import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import SessionEntity from '../../auth/entities/session.entity';
import { AccountService } from '../account.service';
import RedisService from '../../providers/redis.service';
import {
  base32Decode,
  base32Encode,
  generateNanoId,
  unixTimestamp,
} from '../../utils/util';
import { PrismaService } from '../../providers/prisma.service';

@Injectable()
export class TwoFactorService {
  //TOTP Configuration
  private static readonly ALGORITHM = 'sha1';
  private static readonly ISSUER = 'faisal.gg';
  public static readonly DIGITS = 6;
  private static readonly PERIOD = 30;
  private static readonly VERIFICATION_EXPIRES = 60 * 5; //Seconds (5 Min);

  constructor(
    private readonly config: ConfigService,
    private readonly accountService: AccountService,
    private readonly kv: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  public async configureSMS(session: SessionEntity) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );
    if (account.twoFactor.methods.includes('SMS'))
      throw new BadRequestException({
        code: '2fa_sms_already_enabled',
        message:
          'Two-Factor Authentication (2FA) using SMS verification is already enabled for this account. No further action is required.',
      });
  }

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
      `totp:${account.id}`,
      TwoFactorService.VERIFICATION_EXPIRES,
      key,
    );

    return {
      uri: this.createTOTPUri(secret, account.email),
      expires: unixTimestamp(TwoFactorService.VERIFICATION_EXPIRES),
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

    const key: string = await this.kv.get(`totp:${account.id}`);
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

    await this.kv.del(`totp:${account.id}`);

    await this.prisma.account.updateMany({
      data: {
        twoFactorAuthAppKey: key,
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
      Math.floor(Date.now() / 1000) / TwoFactorService.PERIOD,
    );

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(
      BigInt(
        Math.floor(Math.floor(Date.now() / 1000) / TwoFactorService.PERIOD),
      ),
      0,
    );

    const buffer = createHmac('sha1', base32Decode(secret))
      .update(counterBuffer)
      .digest();
    const offset = buffer[buffer.length - 1] & 0x0f;
    const otp =
      (buffer.readUInt32BE(offset) & 0x7fffffff) %
      10 ** TwoFactorService.DIGITS;

    return otp.toString().padStart(TwoFactorService.DIGITS, '0');
  }

  private createTOTPUri(secret: string, displayName: string) {
    const params = new URLSearchParams({
      secret,
      issuer: TwoFactorService.ISSUER,
      period: String(TwoFactorService.PERIOD),
      digits: String(TwoFactorService.DIGITS),
      algorithm: TwoFactorService.ALGORITHM,
    });
    return `otpauth://totp/${
      TwoFactorService.ISSUER
    }:${displayName}?${params.toString()}`;
  }
}
