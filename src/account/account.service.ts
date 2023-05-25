import { Injectable } from "@nestjs/common";
import { PrismaService } from "../providers/prisma.service";
import { AccountEntity } from "./entities/account.entity";

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {
  }

  public async getAccount(publicId: string) {
    return new AccountEntity(await this.prisma.account.findUnique({
      where: {
        publicId: publicId
      }
    }));
  }

}
