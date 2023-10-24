import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import SessionEntity from '../../auth/entities/session.entity';
import { PrismaService } from '../../core/providers/prisma.service';
import TrustedAccountSessionEntity from './entities/trusted-account-session.entity';
import { ActivityAction, ActivityOperationType, Prisma } from '@prisma/client';
import RedisService from '../../core/providers/redis.service';
import {
  SignificantRequestInformation,
  unixTimestamp,
} from '../../core/utils/util';
import { AuthService } from '../../auth/auth.service';
import AccountActivityGlobalService from '../../core/services/account-activity.global.service';
import SessionGlobalService from '../../core/services/session.global.service';

@Injectable()
export class SessionsService {
  private readonly logger: Logger = new Logger('SessionService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly kv: RedisService,
    private readonly accountActivityService: AccountActivityGlobalService,
    private readonly sessionService: SessionGlobalService,
  ) {}

  public async getAll(session: SessionEntity) {
    const sessions = await this.prisma.accountSession.findMany({
      where: {
        accountId: session.getAccount().id,
        revokedAt: null,
        tokens: {
          every: {
            expires: {
              gte: new Date(),
            },
          },
        },
      },
      include: {
        tokens: {
          include: {
            visitor: true,
          },
        },
      },
    });
    return sessions.map(
      (s) => new TrustedAccountSessionEntity(s, session.getToken()),
    );
  }

  public async deleteAll(
    session: SessionEntity,
    sri: SignificantRequestInformation,
  ) {
    const targetActiveSessions =
      await this.sessionService.revokeAllActiveSession(
        session.getAccount().id,
        {
          excluded: [session.getPrimaryPublicId()],
          throwIfNoActiveSessions: true,
        },
      );

    await this.accountActivityService.create(
      session,
      sri,
      ActivityOperationType.DELETE,
      ActivityAction.SESSION_REVOKED,
      targetActiveSessions.map((s) => ({
        key: 'sessionId',
        value: String(s.id),
      })),
    );
  }

  public async delete(
    session: SessionEntity,
    sri: SignificantRequestInformation,
    primarySessionId: string,
  ) {
    if (session.getPrimaryPublicId() === primarySessionId)
      throw new BadRequestException({
        code: 'self_session',
        message:
          'Deleting the current user session is not allowed in this endpoint.',
      });
    const targetActiveSession = await this.prisma.accountSession.findFirst({
      where: {
        publicId: primarySessionId,
        accountId: session.getAccount().id,
        revokedAt: null,
      },
    });
    if (!targetActiveSession)
      throw new BadRequestException({
        code: 'session_not_exist',
        message: 'The session you are trying to delete does not exist.',
      });
    const deletedSession = await this.prisma.accountSession
      .update({
        where: {
          publicId: primarySessionId,
        },
        data: {
          revokedAt: new Date(),
        },
        select: {
          tokens: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      })
      .catch((err: Prisma.PrismaClientKnownRequestError) => {
        if (err.code === 'P2025')
          throw new BadRequestException({
            code: 'session_not_exist',
            message: 'The session you are trying to delete does not exist.',
          });
        this.logger.error(
          'Error while trying to delete session',
          session,
          primarySessionId,
          err,
        );
        throw new ServiceUnavailableException();
      });

    const token = deletedSession.tokens.at(0);

    if (!token) {
      this.logger.error(
        'Something was wrong while looking to token to delete the session from redis.',
      );
      throw new ServiceUnavailableException();
    }

    await this.kv.del(`session:${token.publicId}`);

    await this.accountActivityService.create(
      session,
      sri,
      ActivityOperationType.DELETE,
      ActivityAction.SESSION_REVOKED,
      [
        {
          key: 'sessionId',
          value: String(targetActiveSession.id),
        },
      ],
    );
  }
}
