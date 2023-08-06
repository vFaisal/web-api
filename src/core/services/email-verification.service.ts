import RedisService from '../providers/redis.service';
import ThrottlerService from '../security/throttler.service';
import SendgridService from '../providers/sendgrid.service';
import { argon2id, hash } from 'argon2';
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

@Injectable()
export default class EmailVerificationService {
  public static readonly DEFAULT_ATTEMPTS: number = 5;
  public static readonly DEFAULT_RESEND: number = 2;
  public static readonly VERIFICATION_EXPIRATION = 60 * 10;

  private readonly logger: Logger = new Logger('EmailVerificationService');

  constructor(
    private readonly kv: RedisService,
    private readonly sendgrid: SendgridService,
    private readonly throttler: ThrottlerService,
    private readonly config: ConfigService,
  ) {}

  // message param must contain ###### to replace it with the verification code
  public async start(
    email: string,
    ip: string,
    intent: string,
    message: {
      description: string;
      subject: string;
    },
    {
      accountId = null,
      tokenLength = 16,
    }: { accountId?: bigint | null; tokenLength?: number },
  ) {
    if (!message.description.includes('######')) {
      this.logger.debug('Message not contain ###### to processed', message);
      throw new ServiceUnavailableException();
    }

    if (accountId)
      await this.throttler.throwIfRateLimited(
        'emailVerificationService:account:' + accountId,
        15 * 60,
        3,
        'account',
      );
    else
      await this.throttler.throwIfRateLimited(
        'emailVerificationService:ip:' + ip,
        15 * 60,
        2,
        'ip',
      );

    await this.throttler.throwIfRateLimited(
      'emailVerificationService:email:' + email,
      15 * 60,
      5,
      'data',
    );

    const randomDigit = randomInt(100_000, 999_999);
    const token = generateNanoId(tokenLength ?? 16);

    await this.kv.setex<EmailVerificationCache>(
      'emailVerification:' + email,
      EmailVerificationService.VERIFICATION_EXPIRATION,
      {
        email: email,
        intent,
        token: token,
        code: String(randomDigit),
        accountId: accountId ? String(accountId) : null,
        resend: 0,
        lastResendTimestamp: null,
        attempts: 0,
      },
    );

    if (this.config.get('NODE_ENV') == 'production') {
      await this.sendgrid.sendEmail(email, message.subject, {
        type: 'text/plain',
        value: message.description.replace('######', String(randomDigit)),
      });
    } else
      this.logger.debug(`[Email: ${email}] Verification code: `, randomDigit);

    return token;
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

    if (cache.resend >= EmailVerificationService.DEFAULT_RESEND)
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
      cache.lastResendTimestamp > Date.now() - 30 * 1000
    )
      throw new BadRequestException({
        code: 'resend_email_verification_cooldown',
        message:
          'Please wait for a specified cooldown period before attempting to resend the email verification.',
      });

    await this.kv.setex<EmailVerificationCache>(
      'emailVerification:' + email,
      EmailVerificationService.VERIFICATION_EXPIRATION,
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
      await this.sendgrid.sendEmail(email, message.subject, {
        type: 'text/plain',
        value: message.description.replace('######', cache.code),
      });
    } else
      this.logger.debug(`[Email: ${email}] Verification code: `, cache.code);
  }

  public async verify(
    code: string,
    token: string,
    email: string,
    intent: string,
    accountId?: bigint,
  ) {
    const cache = await this.retrieveCache(token, email, intent, accountId);

    if (cache.attempts >= EmailVerificationService.DEFAULT_ATTEMPTS) {
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
        EmailVerificationService.VERIFICATION_EXPIRATION,
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
        message:
          'The email verification code provided is invalid. Please ensure you have entered the correct code and try again.',
      });
    }

    await this.kv.del('emailVerification:' + email);
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
        message:
          'A new email verification is required. Please generate a new verification code and try again.',
      });
    if (cache.token !== token || cache.intent !== intent)
      throw new BadRequestException({
        code: 'email_verification_token_invalid',
        message:
          'The email verification token provided is not valid. Please verify the token and try again.',
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
