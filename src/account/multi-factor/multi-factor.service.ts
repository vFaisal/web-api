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
import TotpService from '../../core/services/totp.service';

@Injectable()
export class MultiFactorService {
  private static readonly VERIFICATION_EXPIRES = 60 * 10; //Seconds (10 Min);

  constructor(
    private readonly config: ConfigService,
    private readonly accountService: AccountService,
    private readonly kv: RedisService,
    private readonly prisma: PrismaService,
    private readonly totpService: TotpService,
  ) {}

  public async enableEmail(session: SessionEntity) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );
    if (account.multiFactor.methods.email)
      throw new BadRequestException({
        code: 'mfa_email_already_enabled',
        message:
          'Multi-Factor Authentication (MFA) via Email is already enabled for this account. No further action is required.',
      });

    if (!account.verified.email)
      throw new BadRequestException({
        code: 'mfa_email_requires_verified_email',
        message:
          'Email verification is required to enable Email-based Multi-Factor Authentication (MFA). Please verify your email before proceeding.',
      });

    await this.prisma.account.updateMany({
      data: {
        mfaEmail: new Date(),
      },
      where: {
        id: account.raw.account.id,
      },
    });

    return;
  }

  public async disableEmail(session: SessionEntity) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );
    if (!account.multiFactor.methods.email)
      throw new BadRequestException({
        code: 'mfa_email_already_disabled',
        message:
          'Multi-Factor Authentication (MFA) via Email is already disabled for this account. No further action is required.',
      });

    await this.prisma.account.updateMany({
      data: {
        mfaEmail: null,
      },
      where: {
        id: account.raw.account.id,
      },
    });

    return;
  }

  public async enableSMS(session: SessionEntity) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );
    if (account.multiFactor.methods.sms)
      throw new BadRequestException({
        code: 'mfa_sms_already_enabled',
        message:
          'Multi-Factor Authentication (MFA) via SMS is already enabled for this account. No further action is required.',
      });

    if (!account.verified.phone)
      throw new BadRequestException({
        code: 'mfa_sms_requires_verified_phone_number',
        message:
          'Phone number verification is required to enable SMS-based Multi-Factor Authentication (MFA). Please verify your phone number before proceeding.',
      });

    await this.prisma.account.updateMany({
      data: {
        mfaSMS: new Date(),
      },
      where: {
        id: account.raw.account.id,
      },
    });

    return;
  }

  public async disableSMS(session: SessionEntity) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );
    if (!account.multiFactor.methods.sms)
      throw new BadRequestException({
        code: 'mfa_sms_already_disabled',
        message:
          'Multi-Factor Authentication (MFA) via SMS is already disabled for this account. No further action is required.',
      });

    await this.prisma.account.updateMany({
      data: {
        mfaSMS: null,
      },
      where: {
        id: account.raw.account.id,
      },
    });

    return;
  }

  public async enableWhatsapp(session: SessionEntity) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );

    if (!account.multiFactor.methods.sms)
      throw new BadRequestException({
        code: 'mfa_whatsapp_requires_sms',
        message:
          'Multi-Factor Authentication (MFA) via WhatsApp requires SMS MFA to be enabled.',
      });

    if (account.multiFactor.methods.whatsapp)
      throw new BadRequestException({
        code: 'mfa_whatsapp_already_enabled',
        message:
          'Multi-Factor Authentication (MFA) via Whatsapp is already disabled for this account. No further action is required.',
      });

    if (!account.verified.phone)
      throw new BadRequestException({
        code: 'mfa_whatsapp_requires_verified_phone_number',
        message:
          'Phone number verification is required to enable Whatsapp-based Multi-Factor Authentication (MFA). Please verify your phone number before proceeding.',
      });

    await this.prisma.account.updateMany({
      data: {
        mfaWhatsapp: new Date(),
      },
      where: {
        id: account.raw.account.id,
      },
    });

    return;
  }

  public async disableWhatsapp(session: SessionEntity) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );
    if (!account.multiFactor.methods.whatsapp)
      throw new BadRequestException({
        code: 'mfa_whatsapp_already_disabled',
        message:
          'Multi-Factor Authentication (MFA) via disabled verification is already disabled for this account. No further action is required.',
      });

    await this.prisma.account.updateMany({
      data: {
        mfaWhatsapp: null,
      },
      where: {
        id: account.raw.account.id,
      },
    });

    return;
  }

  public async configureTOTP(session: SessionEntity) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );
    if (account.multiFactor.methods.app)
      throw new BadRequestException({
        code: 'mfa_authentication_app_already_enabled',
        message:
          'Multi-Factor Authentication (MFA) authentication app is already enabled for this account. Please disable the current MFA app before attempting to enable a new one.',
      });

    const key = generateNanoId(16);
    const secret = this.totpService.createSecret(key);

    await this.kv.setex(
      `totp_mfa_configuration:${account.id}`,
      MultiFactorService.VERIFICATION_EXPIRES,
      key,
    );

    return {
      uri: this.totpService.createUri(secret, account.email),
      expires: unixTimestamp(MultiFactorService.VERIFICATION_EXPIRES),
    };
  }

  public async verifyTOTP(session: SessionEntity, digit: string) {
    const account = await this.accountService.getSafeAccountData(
      session.getAccount().id,
    );
    if (account.multiFactor.methods.app)
      throw new BadRequestException({
        code: 'mfa_authentication_app_already_enabled',
        message:
          'The Multi-Factor Authentication (MFA) authentication app is already enabled for this account. Please disable the current MFA app before attempting to enable a new one.',
      });

    const key: string = await this.kv.get(
      `totp_mfa_configuration:${account.id}`,
    );
    if (!key)
      throw new BadRequestException({
        code: 'mfa_authentication_app_new_configuration_required',
        message:
          'A new configuration for the Multi-Factor Authentication (MFA) authentication app is required. Please generate a new configuration to enable the MFA app.',
      });

    const generatedDigit = this.totpService.generateCode(
      this.totpService.createSecret(key),
    );

    if (generatedDigit !== digit)
      throw new BadRequestException({
        code: 'mfa_authentication_app_configuration_invalid_code',
        message:
          'The provided configuration code for the Multi-Factor Authentication (MFA) authentication app is incorrect. Please ensure you have entered the correct code and try again.',
      });

    await this.kv.del(`totp_mfa_configuration:${account.id}`);

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
    if (!account.multiFactor.methods.app)
      throw new BadRequestException({
        code: 'mfa_authentication_app_already_disabled',
        message:
          'Multi-Factor Authentication (MFA) via App is already disabled for this account. No further action is required.',
      });

    await this.prisma.account.updateMany({
      data: {
        mfaAppKey: null,
      },
      where: {
        id: account.raw.account.id,
      },
    });

    return;
  }
}

interface TOTPConfiguration {
  key: string;
  backupCodes: string[];
}
