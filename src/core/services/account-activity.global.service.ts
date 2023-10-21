import { PrismaService } from '../providers/prisma.service';
import {
  Provider,
  ActivityOperationType,
  ActivityAction,
} from '@prisma/client';
import { generateNanoId, SignificantRequestInformation } from '../utils/util';
import SessionEntity from '../../auth/entities/session.entity';

export default class AccountActivityGlobalService {
  constructor(private readonly prisma: PrismaService) {}

  public async create(
    session: SessionEntity,
    sri: SignificantRequestInformation,
    operationType: ActivityOperationType,
    action: ActivityAction,
    data?: { key: string; value: string }[],
  ) {
    const publicId = generateNanoId();
    this.prisma.accountActivity.create({
      data: {
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
            counterCode: sri.countryCode,
          },
        },
        session: {
          connect: {
            publicId: session.getSecondaryPublicId(),
          },
        },
        data: {
          createMany: {
            data: data,
          },
        },
      },
    });
  }
}
