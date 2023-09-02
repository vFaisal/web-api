import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../providers/prisma.service';
import RedisService from '../providers/redis.service';
import { Prisma } from '@prisma/client';

@Injectable()
export default class SessionService {
  private readonly logger: Logger = new Logger('SessionService');
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
}
