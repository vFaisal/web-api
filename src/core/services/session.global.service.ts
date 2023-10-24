import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../providers/prisma.service';
import RedisService from '../providers/redis.service';
import { AuthService } from '../../auth/auth.service';
import Constants from "../utils/constants";

@Injectable()
export default class SessionGlobalService {
  private readonly logger: Logger = new Logger('SessionGlobalService');
  constructor(
    private readonly prisma: PrismaService,
    private readonly kv: RedisService,
  ) {}

  public async revoke(
    primaryId: string,
    accountId: bigint,
    secondaryId?: string,
  ) {
    await this.prisma.accountSession.updateMany({
      where: {
        publicId: primaryId,
        accountId: accountId,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    if (!secondaryId) {
      const token = await this.prisma.accountSessionTokens.findFirstOrThrow({
        where: {
          ref: primaryId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      secondaryId = token.publicId;
    }

    await this.kv.del(`session:${secondaryId}`);
  }

  public async revokeAllActiveSession(
    accountId: bigint,
    {
      excluded,
      throwIfNoActiveSessions,
    }: { excluded?: string[]; throwIfNoActiveSessions?: boolean },
  ) {
    const targetActiveSessions = await this.prisma.accountSession.findMany({
      where: {
        accountId: accountId,
        NOT: {
          publicId: {
            notIn: excluded,
          },
        },
        revokedAt: null,
        tokens: {
          every: {
            expires: {
              gte: new Date(),
            },
          },
        },
      },
      select: {
        tokens: {
          orderBy: {
            id: 'desc',
          },
          take: 1,
        },
        id: true,
      },
    });

    if (targetActiveSessions.length < 1) {
      if (!throwIfNoActiveSessions) return;
      throw new BadRequestException({
        code: 'no_active_sessions',
        message:
          'There are no active sessions to delete, except for the currently active session.',
      });
    }

    const activeSessionsNeedToRevoke = targetActiveSessions.flatMap((s) =>
      s.tokens
        .filter(
          (t) =>
            t.createdAt.getTime() >
            Date.now() - Constants.ACCESS_TOKEN_EXPIRATION * 1000,
        )
        .map((t) => t.publicId),
    );

    for (const sid of activeSessionsNeedToRevoke) {
      await this.kv.del(`session:${sid}`);
    }

    await this.prisma.accountSession.updateMany({
      where: {
        id: {
          in: targetActiveSessions.map((s) => s.id),
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return targetActiveSessions;
  }
}
