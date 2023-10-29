import { PrismaService } from '../providers/prisma.service';
import {
  Provider,
  ActivityOperationType,
  ActivityAction,
} from '@prisma/client';
import { generateNanoId, SignificantRequestInformation } from '../utils/util';
import SessionEntity from '../../auth/entities/session.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export default class AccountActivityGlobalService {
  constructor(private readonly prisma: PrismaService) {}

  public async create(
    sessionOrAccountId: SessionEntity | bigint,
    sri: SignificantRequestInformation,
    operationType: ActivityOperationType,
    action: ActivityAction,
    data?: { key: string; value: string }[],
  ) {
    const publicId = generateNanoId();
    const sessionToken =
      sessionOrAccountId instanceof SessionEntity
        ? {
            sessionToken: {
              connect: {
                publicId: sessionOrAccountId.getSecondaryPublicId(),
              },
            },
          }
        : undefined;
    const accountId: bigint =
      sessionOrAccountId instanceof SessionEntity
        ? sessionOrAccountId.getAccount().id
        : sessionOrAccountId;


    await this.prisma.accountActivity.create({
      data: {
        ...sessionToken,
        publicId: publicId,
        operationType: operationType,
        action: action,
        visitor: {
          create: {
            publicId: generateNanoId(),
            userAgent: sri.userAgent,
            isp: sri.isp,
            city: sri.city,
            region: sri.region,
            ipAddress: sri.ipAddress,
            countryCode: sri.countryCode,
          },
        },
        account: {
          connect: {
            id: accountId
          }
        },
        data: {
          createMany: {
            data: data ?? [],
          },
        },
      },
    });
  }
}
