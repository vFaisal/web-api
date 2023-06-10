import { Injectable } from "@nestjs/common";
import SessionEntity from "../../auth/entities/session.entity";
import { PrismaService } from "../../providers/prisma.service";
import TrustedAccountSessionEntity from "./dto/trusted-account-session.entity";

@Injectable()
export class SessionsService {

  constructor(private readonly prisma: PrismaService) {
  }

  public async getAll(session: SessionEntity) {
    const sessions = await this.prisma.accountSession.findMany({
      where: {
        accountId: session.accountId,
        revokedAt: null
      },
      include: {
        tokens: {
          where: {
            expires: {
              gte: new Date()
            }
          },
          include: {
            visitor: true
          }
        }
      }
    });
    return sessions.map((s) => new TrustedAccountSessionEntity(s, session.rid));
  }
}
