import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import RegistrationDto from "./dto/registration.dto";
import {
  generateNanoId,
  SignificantRequestInformation,
  significantRequestInformation,
  unixTimestamp
} from "../utils/util";
import { argon2id, hash } from "argon2";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import { AuthService } from "../auth/auth.service";
import { SessionType } from "@prisma/client";

@Injectable()
export class RegistrationService {

  constructor(private readonly prisma: PrismaService, private authenticate: AuthService) {
  }

  public async createAccount(params: RegistrationDto, significantRequestInformation: SignificantRequestInformation) {
    const verification = await this.prisma.oTPVerification.findUnique({
      where: {
        signature: params.signature
      }
    });
    if (!verification || verification.intent !== "REGISTRATION" || verification.phoneOrEmail !== params.email || !verification.verifiedAt) throw new BadRequestException("Invalid signature");
    if (verification.verifiedAt.getTime() <= Date.now() - 3600_000) new BadRequestException("Signature has expired"); // 1 hour

    const account = await this.prisma.account.create({
      data: {
        email: verification.phoneOrEmail,
        verificationId: verification.id,
        passwordHash: await hash(params.password, {
          version: argon2id
        }),
        publicId: generateNanoId()
      }
    }).catch((err: PrismaClientKnownRequestError) => {
      if (err.code == "P2002") throw new ConflictException();
      throw new InternalServerErrorException();
    });

    return {
      account: {
        id: account.publicId,
        email: account.email,
        displayName: account.displayName,
        createdAt: account.createdAt
      },
      credentials: await this.authenticate.createCredentials(account, significantRequestInformation, SessionType.EMAIL)
    };
  }
}
