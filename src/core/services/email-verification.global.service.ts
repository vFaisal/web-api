import RedisService from '../providers/redis.service';
import ThrottlerService from '../security/throttler.service';
import SendgridService from '../providers/sendgrid.service';
import { generateNanoId, unixTimestamp } from '../utils/util';
import { randomInt } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import ResendService from '../providers/resend.service';

@Injectable()
export default class EmailVerificationGlobalService {
  public static readonly DEFAULT_ATTEMPTS: number = 5;
  public static readonly DEFAULT_RESEND: number = 2;
  public static readonly VERIFICATION_EXPIRATION = 60 * 10;

  public static readonly RESEND_COOLDOWN = 30; // 30 seconds

  private readonly logger: Logger = new Logger(
    'EmailVerificationGlobalService',
  );

  constructor(
    private readonly kv: RedisService,
    private readonly sendgrid: SendgridService,
    private readonly resendService: ResendService,
    private readonly throttler: ThrottlerService,
    private readonly config: ConfigService,
  ) {}

  // message param must contain ###### to replace it with the verification code
  public async start(
    email: string,
    unique: {
      type: 'account';
      identifier: bigint;
    },
    intent: string,
    message: {
      description: string;
      subject: string;
    },
    tokenLength?: number,
  ): Promise<{token: string, expires: number}>;
  public async start(
    email: string,
    unique: {
      type: 'ip';
      identifier: string;
    },
    intent: string,
    message: {
      description: string;
      subject: string;
    },
    tokenLength?: number,
  ): Promise<{token: string, expires: number}>;
  public async start(
    email: string,
    unique: {
      type: 'ip' | 'account';
      identifier: string | bigint;
    },
    intent: string,
    message: {
      description: string;
      subject: string;
    },
    tokenLength = 16,
  ): Promise<{token: string, expires: number}> {
    if (!message.description.includes('######')) {
      this.logger.debug('Message not contain ###### to processed', message);
      throw new ServiceUnavailableException();
    }

    if (unique.type === 'account')
      await this.throttler.throwIfRateLimited(
        'emailVerificationService:account:' + unique.identifier,
        15 * 60,
        3,
        'account',
      );
    else if (this.config.get('NODE_ENV') === 'production')
      await this.throttler.throwIfRateLimited(
        'emailVerificationService:ip:' + unique.identifier,
        25 * 60,
        3,
        'ip',
      );

    await this.throttler.throwIfRateLimited(
      'emailVerificationService:email:' + email,
      25 * 60,
      6,
      'data',
    );

    const randomDigit = randomInt(100_000, 999_999);
    const token = generateNanoId(tokenLength ?? 16);

    await this.kv.setex<EmailVerificationCache>(
      'emailVerification:' + email,
      EmailVerificationGlobalService.VERIFICATION_EXPIRATION,
      {
        email: email,
        intent,
        token: token,
        code: String(randomDigit),
        accountId: unique.type === 'account' ? String(unique.identifier) : null,
        resend: 0,
        lastResendTimestamp: Date.now(),
        attempts: 0,
      },
    );

    if (this.config.get('NODE_ENV') == 'production') {
      await this.resendService.sendEmail(email, message.subject, {
        text: message.description.replace('######', String(randomDigit)),
      });
    } else
      this.logger.debug(`[Email: ${email}] Verification code: `, randomDigit);

    return {
      token: token,
      expires: unixTimestamp(EmailVerificationGlobalService.VERIFICATION_EXPIRATION)
    };
  }

  public async resend(
    token: string,
    email: string,
    intent: string,
    message: {
      description: string;
      subject: string;
    },
    accountId?: bigint,
  ) {
    if (!message.description.includes('######')) {
      this.logger.debug('Message not contain ###### to processed', message);
      throw new ServiceUnavailableException();
    }

    const cache = await this.retrieveCache(token, email, intent, accountId);

    if (cache.resend >= EmailVerificationGlobalService.DEFAULT_RESEND)
      throw new HttpException(
        {
          code: 'resend_email_verification_limit_reached',
          message:
            'The maximum number of resend attempts for the email verification has been exceeded. Please start a new email verification process to obtain a fresh verification code.',
        },
        429,
      );

    if (
      cache.lastResendTimestamp &&
      cache.lastResendTimestamp >
        Date.now() - EmailVerificationGlobalService.RESEND_COOLDOWN * 1000
    )
      throw new BadRequestException({
        code: 'resend_email_verification_cooldown',
        message:
          'Please wait for a specified cooldown period before attempting to resend the email verification.',
      });

    await this.kv.setex<EmailVerificationCache>(
      'emailVerification:' + email,
      EmailVerificationGlobalService.VERIFICATION_EXPIRATION,
      {
        email: cache.email,
        intent: cache.intent,
        code: cache.code,
        token: cache.token,
        accountId: cache.accountId,
        attempts: cache.attempts,
        lastResendTimestamp: Date.now(),
        resend: cache.resend + 1,
      },
    );

    if (this.config.get('NODE_ENV') == 'production') {
      await this.resendService.sendEmail(email, message.subject, {
        text: message.description.replace('######', cache.code),
      });
    } else
      this.logger.debug(`[Email: ${email}] Verification code: `, cache.code);

    const remaining = EmailVerificationGlobalService.DEFAULT_RESEND - cache.resend - 1;

    return {
      nextResend: remaining > 0 ? unixTimestamp(EmailVerificationGlobalService.RESEND_COOLDOWN) : null,
      remaining: remaining
    };
  }

  public async verify(
    code: string,
    token: string,
    email: string,
    intent: string,
    accountId?: bigint,
  ) {
    const cache = await this.retrieveCache(token, email, intent, accountId);

    if (cache.attempts >= EmailVerificationGlobalService.DEFAULT_ATTEMPTS) {
      await this.kv.del('emailVerification:' + email);
      throw new HttpException(
        {
          code: 'verify_email_attempts_limit_reached',
          message:
            'The maximum number of attempts to verify the email has been reached. Please initiate a new verification process to receive a fresh verification code.',
        },
        429,
      );
    }

    if (cache.code !== code) {
      await this.kv.setex<EmailVerificationCache>(
        'emailVerification:' + email,
        EmailVerificationGlobalService.VERIFICATION_EXPIRATION,
        {
          email: cache.email,
          intent: cache.intent,
          code: cache.code,
          token: cache.token,
          accountId: cache.accountId,
          attempts: cache.attempts + 1,
          lastResendTimestamp: cache.lastResendTimestamp,
          resend: cache.resend,
        },
      );

      throw new BadRequestException({
        code: 'invalid_email_verification_code',
        message: 'The email verification code provided is invalid.',
      });
    }

    await this.kv.del('emailVerification:' + email);

    return cache;
  }

  private async retrieveCache(
    token: string,
    email: string,
    intent: string,
    accountId?: bigint,
  ) {
    const cache = await this.kv.get<EmailVerificationCache>(
      'emailVerification:' + email,
    );

    if (!cache)
      throw new BadRequestException({
        code: 'new_email_verification_required',
        message: 'A new email verification is required.',
      });
    if (cache.token !== token || cache.intent !== intent)
      throw new BadRequestException({
        code: 'email_verification_token_invalid',
        message: 'The email verification token provided is not valid.',
      });

    if (accountId && cache.accountId && BigInt(cache.accountId) !== accountId)
      throw new ForbiddenException();

    return cache;
  }
}

type EmailVerificationCache = {
  email: string;
  intent: string;
  accountId: null | string;
  token: string;
  code: string;
  resend: number;
  lastResendTimestamp: number | null;
  attempts: number;
};
