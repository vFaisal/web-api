import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {
  }

  public async getAccount(publicId: string) {
    return this.prisma.account.findUnique({
      where: {
        publicId: publicId
      },
      select: {
        publicId: true,
        displayName: true,
        email: true,
        createdAt: true
      }
    });
  }

}
