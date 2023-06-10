import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import SessionEntity from "../../auth/entities/session.entity";
import { PrismaService } from "../../providers/prisma.service";
import TrustedAccountSessionEntity from "./dto/trusted-account-session.entity";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import RedisService from "../../providers/redis.service";

@Injectable()
export class SessionsService {

  private readonly logger: Logger = new Logger("SessionService");

  constructor(private readonly prisma: PrismaService, private readonly kv: RedisService) {
  }

  public async getAll(session: SessionEntity) {
    const sessions = await this.prisma.accountSession.findMany({
      where: {
        accountId: session.accountId,
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
    return sessions.map((s) => new TrustedAccountSessionEntity(s, session.rid));
  }

  public async delete(session: SessionEntity, sessionId: string) {
    if (session.primarySessionId === sessionId) throw new BadRequestException({
      code: "self_session",
      message: "Deleting the current user session is not allowed."
    });
    const targetSession = await this.prisma.accountSession.findFirst({
      where: {
        publicId: sessionId,
        accountId: session.accountId,
        revokedAt: null
      }
    });
    if (!targetSession) throw new BadRequestException({
      code: "session_not_exist",
      message: "The session you are trying to delete does not exist."
    });
    const deletedSession = await this.prisma.accountSession.update({
      where: {
        publicId: sessionId

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
    }).catch((err: PrismaClientKnownRequestError) => {
      if (err.code === "P2025") throw new BadRequestException({
        code: "session_not_exist",
        message: "The session you are trying to delete does not exist."
      });
      this.logger.error("Error while trying to delete session", session, sessionId, err);
      throw new ServiceUnavailableException();
    });

    const token = deletedSession.tokens.at(0);

    if (!token) {
      this.logger.error("Something was wrong while looking to token to delete the session from redis.");
      throw new ServiceUnavailableException();
    }

    await this.kv.del(`session:${token.publicId}`);

  }
}
