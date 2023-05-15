import {
  BadRequestException,
  CACHE_MANAGER,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import RegistrationDto from "./dto/registration.dto";
import { generateNanoId, SignificantRequestInformation } from "../utils/util";
import { argon2id, hash } from "argon2";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import { AuthService } from "../auth/auth.service";
import { SessionType } from "@prisma/client";
import { Cache } from "cache-manager";
import OneTimePasswordEntity from "./verification/entities/one-time-password.entity";
import { serialize } from "class-transformer";
import { AccountEntity } from "../account/entities/account.entity";

@Injectable()
export class RegistrationService {

  constructor(private readonly prisma: PrismaService, private authService: AuthService, @Inject(CACHE_MANAGER) private cache: Cache) {
  }

  public async createAccount(params: RegistrationDto, significantRequestInformation: SignificantRequestInformation) {
    const verification = new OneTimePasswordEntity<"GET">(await this.cache.get(`otp:${params.signature}`));

    if (!verification.isValid() || verification.intent !== "REGISTRATION" || verification.target !== "EMAIL" || verification.phoneOrEmail !== params.email) throw new BadRequestException({
      code: "invalid_signature",
      message: "Access denied due to invalid signature. Please check your signature and try again."
    });

    if (!verification.isVerified()) throw new BadRequestException({
      code: "unverified_signature",
      message: "Access denied due to an unverified signature. Please verify your signature and try again."
    });


    const account = await this.prisma.account.create({
      data: {
        email: verification.phoneOrEmail,
        passwordHash: await hash(params.password, {
          version: argon2id
        }),
        publicId: generateNanoId()
      }
    }).catch((err: PrismaClientKnownRequestError) => {
      if (err.code == "P2002") throw new ConflictException({
        code: "email_already_registered",
        message: "Email address is already associated with an existing account. Please login or use a different email address to create a new account."
      });
      throw new ServiceUnavailableException();
    });

    return {
      account: new AccountEntity(account),
      credentials: await this.authService.createCredentials(account, significantRequestInformation, SessionType.EMAIL)
    };
  }
}
