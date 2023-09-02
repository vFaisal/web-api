import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/providers/prisma.service';
import SessionEntity from '../../auth/entities/session.entity';
import PasswordValidationService from '../../core/services/password-validation.service';
import { AccessLevel } from '../../core/security/authorization.decorator';
import { unixTimestamp } from '../../core/utils/util';
import RedisService from '../../core/providers/redis.service';
import { AuthService } from '../../auth/auth.service';
import { AccountEntity } from '../entities/account.entity';

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordValidation: PasswordValidationService,
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
      email: true,
      password: !safeAccountData.isPasswordLess(),
      sms: safeAccountData.isMFASMSEnabled(),
      whatsapp: safeAccountData.isMFAWhatsappEnabled(),
      app: safeAccountData.isMFAAppEnabled(),
    };
  }

  public async requestMediumAccessLevelByPassword(
    session: SessionEntity,
    password: string,
  ) {
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
    await this.generateAccessLevel(session);
  }

  public async generateAccessLevel(session: SessionEntity) {
    await this.kv.setex(
      `session:${session.getSecondaryPublicId()}`,
      AuthService.EXPIRATION.ACCESS_TOKEN -
        Math.max(Math.round(Date.now() - session.getCreatedTimestampAt()), 180),
      session,
    );
  }
}
