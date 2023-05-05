import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import RegistrationDto from "./dto/registration.dto";
import { generateNanoId, unixTimestamp } from "../utils/util";
import { argon2id, hash } from "argon2";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import { AuthService } from "../auth/auth.service";

@Injectable()
export class RegistrationService {

  constructor(private readonly prisma: PrismaService, private authenticate: AuthService) {
  }

  public async createAccount(params: RegistrationDto) {
    const verification = await this.prisma.oTPVerification.findUnique({
      where: {
        signature: params.signature
      }
    });
    if (!verification || verification.intent !== "REGISTRATION" || verification.phoneOrEmail !== params.email || !verification.verifiedAt) throw new BadRequestException("Invalid signature");
    if (verification.verifiedAt.getTime() <= Date.now() - 3600_000) new BadRequestException("Signature has expired"); // 1 hour

    const user = await this.prisma.user.create({
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
        id: user.publicId,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt
      },
      credentials: await this.authenticate.createSession(user)
    };
  }
}
