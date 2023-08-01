import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import RedisService from '../providers/redis.service';
import TwilioService, {
  VerificationChannel,
} from '../providers/twilio.service';
import { generateNanoId } from '../utils/util';
import ThrottlerService from '../security/throttler.service';

@Injectable()
export default class PhoneVerificationService {
  constructor(
    private readonly kv: RedisService,
    private readonly twilioService: TwilioService,
    private readonly throttler: ThrottlerService,
  ) {}

  private readonly logger: Logger = new Logger('PhoneVerificationService');

  public static readonly VERIFICATION_EXPIRATION = 60 * 10;

  private cacheKey(phoneNumber: string) {
    return 'phoneVerification:' + phoneNumber;
  }

  public async start(
    accountId: bigint,
    phone: {
      countryCallingCode: string;
      number: string;
    },
    channel: VerificationChannel,
  ) {
    const fullPhoneNumber = '+' + phone.countryCallingCode + phone.number;

    const cachedVerificationProcess: PhoneVerificationCache = await this.kv.get(
      this.cacheKey(fullPhoneNumber),
    );

    /**
     * Add rate limit for every phone number e.g. 2 verification every 2 mins && 5 verification every 10 mins
     */
    await this.throttler.throwIfRateLimited(
      'phoneVerificationService:account' + accountId,
      10 * 60,
      2,
      'data',
    );

    await this.throttler.throwIfRateLimited(
      'phoneVerificationService:number:' + fullPhoneNumber,
      20 * 60,
      5,
      'data',
    );

    if (cachedVerificationProcess) {
      if (accountId !== BigInt(cachedVerificationProcess.accountId))
        throw new BadRequestException({
          code: 'phone_number_already_linked',
          message:
            'The phone number provided is already associated with another account. Please use a different phone number or contact support for further assistance.',
        });
      await this.twilioService.cancelVerification(
        cachedVerificationProcess.sid,
      );
    }

    const verification = await this.twilioService.createNewVerification(
      fullPhoneNumber,
      channel,
    );

    const token = generateNanoId();

    await this.kv.setex(
      this.cacheKey(fullPhoneNumber),
      PhoneVerificationService.VERIFICATION_EXPIRATION,
      {
        sid: verification.sid,
        token: token,
        phone,
        accountId: String(accountId),
      } satisfies PhoneVerificationCache,
    );
    return token;
  }

  public async resend(
    phoneNumber: string,
    accountId: bigint,
    token: string,
    channel: VerificationChannel,
  ) {
    const verification = await this.getSessionWithVerify(
      phoneNumber,
      token,
      accountId,
    );

    if (verification.send_code_attempts.length >= 5)
      throw new HttpException(
        {
          code: 'resend_phone_verification_limit_reached',
          message:
            'The maximum number of resend attempts for the phone verification has been exceeded. Please start a new phone verification process to obtain a fresh verification code.',
        },
        429,
      );

    const lastAttemptTimestampDate = Date.parse(
      (verification.send_code_attempts as any[]).at(-1).time,
    );

    if (lastAttemptTimestampDate > Date.now() - 30 * 1000)
      throw new BadRequestException({
        code: 'resend_phone_verification_cooldown',
        message:
          'Please wait for a specified cooldown period before attempting to resend the phone verification.',
      });

    await this.twilioService.createNewVerification(phoneNumber, channel);
  }

  public async verify(
    phoneNumber: string,
    accountId: bigint,
    token: string,
    code: string,
  ) {
    const verification = await this.getSessionWithVerify(
      phoneNumber,
      token,
      accountId,
    );

    const check = await this.twilioService.checkVerification(
      'verificationSid',
      verification.cache.sid,
      code,
    );

    if (check === false) {
      throw new BadRequestException({
        code: 'invalid_phone_verification_code',
        message:
          'The phone verification code provided is invalid. Please ensure you have entered the correct code and try again.',
      });
    }

    await this.kv.del(this.cacheKey(phoneNumber));

    if (check === 'RATELIMIT') {
      throw new HttpException(
        {
          code: 'verify_phone_attempts_limit_reached',
          message:
            'The maximum number of attempts to verify the phone number has been reached. Please initiate a new verification process to receive a fresh verification code.',
        },
        429,
      );
    }
    return verification;
  }

  private async getSessionWithVerify(
    phoneNumber: string,
    token: string,
    accountId: bigint,
  ): Promise<{ cache: PhoneVerificationCache; send_code_attempts: any[] }> {
    const cachedVerificationProcess: PhoneVerificationCache = await this.kv.get(
      this.cacheKey(phoneNumber),
    );
    if (!cachedVerificationProcess)
      throw new BadRequestException({
        code: 'new_phone_verification_required',
        message:
          'A new phone verification is required. Please generate a new verification code and try again.',
      });
    if (cachedVerificationProcess.token !== token)
      throw new BadRequestException({
        code: 'phone_verification_token_invalid',
        message:
          'The phone verification token provided is not valid. Please verify the token and try again.',
      });

    if (BigInt(cachedVerificationProcess.accountId) !== accountId)
      throw new ForbiddenException();

    const verification = await this.twilioService.fetchVerification(
      cachedVerificationProcess.sid,
    );
    if (!verification) {
      this.logger.debug(
        'verification sid fetch from twilio be notFound, there is a bug in the implementation with twilio or our implementation',
      );
      throw new BadRequestException({
        code: 'new_phone_verification_required',
        message:
          'The phone verification token provided is not valid. Please verify the token and try again.',
      });
    }
    return { ...verification, cache: cachedVerificationProcess };
  }
}

interface PhoneVerificationCache {
  sid: string;
  token: string;
  phone: {
    countryCallingCode: string;
    number: string;
  };
  accountId: string;
}
