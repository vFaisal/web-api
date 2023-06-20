import {
  BadRequestException,
  Injectable,
  Logger, NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import SessionEntity from "../../auth/entities/session.entity";
import { PrismaService } from "../../providers/prisma.service";
import TrustedAccountSessionEntity from "./entities/trusted-account-session.entity";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import RedisService from "../../providers/redis.service";
import { unixTimestamp } from "../../utils/util";
import { AuthService } from "../../auth/auth.service";

@Injectable()
export class SessionsService {
  private readonly logger: Logger = new Logger("SessionService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly kv: RedisService
  ) {
  }

  public async getAll(session: SessionEntity) {
    const sessions = await this.prisma.accountSession.findMany({
      where: {
        accountId: session.getAccount().id,
        revokedAt: null,
        tokens: {
          every: {
            expires: {
              gte: new Date()
            }
          }
        }
      },
      include: {
        tokens: {
          include: {
            visitor: true
          }
        }
      }
    });
    return sessions.map(
      (s) => new TrustedAccountSessionEntity(s, session.getToken())
    );
  }

  public async deleteAll(session: SessionEntity) {
    const targetActiveSessions = await this.prisma.accountSession.findMany({
      where: {
        accountId: session.getAccount().id,
        NOT: {
          publicId: session.getPrimaryPublicId()
        },
        revokedAt: null,
        tokens: {
          every: {
            expires: {
              gte: new Date()
            }
          }
        }
      },
      select: {
        tokens: {
          orderBy: {
            id: "desc"
          },
          take: 1
        },
        id: true
      }
    });

    if (targetActiveSessions.length < 1) throw new BadRequestException({
      code: "no_active_sessions",
      message: "There are no active sessions to delete, except for the currently active session."
    });

    const activeSessionsNeedToRevoke = targetActiveSessions.flatMap((s) =>
      s.tokens
        .filter((t) => t.createdAt.getTime() > Date.now() - (AuthService.EXPIRATION.ACCESS_TOKEN * 1000))
        .map((t) => t.publicId)
    );

    for (const sid of activeSessionsNeedToRevoke) {
      await this.kv.del(`session:${sid}`);
    }

    await this.prisma.accountSession.updateMany({
      where: {
        id: {
          in: targetActiveSessions.map(s => s.id)
        }
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  public async delete(session: SessionEntity, primarySessionId: string) {
    if (session.getPrimaryPublicId() === primarySessionId)
      throw new BadRequestException({
        code: "self_session",
        message: "Deleting the current user session is not allowed."
      });
    const targetActiveSession = await this.prisma.accountSession.findFirst({
      where: {
        publicId: primarySessionId,
        accountId: session.getAccount().id,
        revokedAt: null
      }
    });
    if (!targetActiveSession)
      throw new BadRequestException({
        code: "session_not_exist",
        message: "The session you are trying to delete does not exist."
      });
    const deletedSession = await this.prisma.accountSession
      .update({
        where: {
          publicId: primarySessionId
        },
        data: {
          revokedAt: new Date()
        },
        select: {
          tokens: {
            orderBy: {
              createdAt: "desc"
            },
            take: 1
          }
        }
      })
      .catch((err: PrismaClientKnownRequestError) => {
        if (err.code === "P2025")
          throw new BadRequestException({
            code: "session_not_exist",
            message: "The session you are trying to delete does not exist."
          });
        this.logger.error(
          "Error while trying to delete session",
          session,
          primarySessionId,
          err
        );
        throw new ServiceUnavailableException();
      });

    const token = deletedSession.tokens.at(0);

    if (!token) {
      this.logger.error(
        "Something was wrong while looking to token to delete the session from redis."
      );
      throw new ServiceUnavailableException();
    }

    await this.kv.del(`session:${token.publicId}`);
  }
}
