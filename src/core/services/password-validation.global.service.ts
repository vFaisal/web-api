import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Account } from '@prisma/client';
import { argon2id, verify } from 'argon2';
import ThrottlerService from '../security/throttler.service';
import SessionEntity from '../../auth/entities/session.entity';
import { PrismaService } from '../providers/prisma.service';
import RedisService from '../providers/redis.service';
import SessionGlobalService from './session.global.service';
import { AccountEntity } from '../../account/entities/account.entity';

@Injectable()
export default class PasswordValidationGlobalService {
  private static readonly ATTEMPTS_VALIDATE_PASSWORD_LIMIT = 15;
  private static readonly ATTEMPTS_VALIDATE_PASSWORD_TTL = 15 * 60; // 15min
  constructor(
    private readonly throttler: ThrottlerService,
    private readonly prisma: PrismaService,
    private readonly kv: RedisService,
    private readonly sessionService: SessionGlobalService,
  ) {}

  public async validatePasswordIfRateLimitedRevokeSession(
    session: SessionEntity,
    account: Account,
    enteredPassword: string,
  ) {
    const safeAccountData = new AccountEntity(account);
    if (safeAccountData.isPasswordLess())
      throw new BadRequestException({
        code: 'account_passwordless',
        message:
          'Password validation cannot be performed on an account that is currently in passwordless mode.',
      });

    const cacheKey = `validatePasswordAttempts:session:${session.getPrimaryPublicId()}`;

    const throttler = await this.kv.get<ValidatePasswordThrottler>(cacheKey);
    if (throttler) {
      if (
        throttler.attempts >=
        PasswordValidationGlobalService.ATTEMPTS_VALIDATE_PASSWORD_LIMIT
      ) {
        await this.sessionService.revoke(
          session.getPrimaryPublicId(),
          account.id,
          session.getSecondaryPublicId(),
        );
        throw new UnauthorizedException({
          code: 'session_revoked_due_to_attempts',
          message:
            'Your session has been revoked due to too many failed password validation attempts. Re-authenticate to access your account.',
        });
      }
    }

    const isVerifiedPassword = await verify(
      account.passwordHash,
      enteredPassword,
      {
        version: argon2id,
      },
    );
    if (!isVerifiedPassword) {
      await this.kv.setex<ValidatePasswordThrottler>(
        cacheKey,
        PasswordValidationGlobalService.ATTEMPTS_VALIDATE_PASSWORD_TTL,
        {
          attempts: (throttler?.attempts ?? 0) + 1,
        },
      );
      throw new BadRequestException({
        code: 'current_password_mismatch',
        message:
          "The current password you provided does not match your account's current password.",
      });
    }
    if (throttler) await this.kv.del(cacheKey);
  }
}

interface ValidatePasswordThrottler {
  attempts: number;
}
