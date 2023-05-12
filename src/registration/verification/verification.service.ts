import {
  BadRequestException, CACHE_MANAGER,
  ConflictException,
  HttpException, HttpStatus, Inject,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { generateNanoId, unixTimestamp } from "../../utils/util";
import { randomInt } from "crypto";
import { hash, verify, argon2id } from "argon2";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import { Cache } from "cache-manager";
import OneTimePasswordEntity from "./entities/one-time-password.entity";
import { OneTimePasswordVerificationIntent, OneTimePasswordVerificationTarget } from "@prisma/client";

@Injectable()
export class VerificationService {

  private static readonly ONE_TIME_PASSWORD_EXPIRATION_MS = 60 * 15 * 1000;
  private static readonly ONE_TIME_PASSWORD_VERIFIED_EXPIRATION_MS = 60 * 60 * 1000;

  constructor(private prisma: PrismaService, @Inject(CACHE_MANAGER) private cache: Cache) {
  }


  public async createEmailVerification(email: string) {
    const existAccount = await this.prisma.account.findUnique({
      where: {
        email: email
      },
      select: {
        id: true
      }
    });
    if (existAccount) throw new ConflictException({
      code: "email_taken",
      message: "Email address is already associated with an existing account. Please login or use a different email address to create a new account."
    });
    const randomDigit = randomInt(100_000, 999_999);
    const signature = generateNanoId(128);

    await this.cache.set(`otp:${signature}`, new OneTimePasswordEntity<"CREATION">({
      phoneOrEmail: email,
      target: "EMAIL",
      intent: "REGISTRATION",
      signature,
      hashCode: await hash(String(randomDigit), {
        version: argon2id
      }),
      attempts: 0,
      allowedAttempts: 10,
      createdTimestampAt: unixTimestamp()
    }), VerificationService.ONE_TIME_PASSWORD_EXPIRATION_MS);

    console.log("Verification Code: ", randomDigit);
    return {
      signature
    };
  }

  public async verifyEmail({ email, signature, code }: { email: string, signature: string, code: number }) {
    let oneTimePassword = new OneTimePasswordEntity<"GET">(await this.cache.get(`otp:${signature}`));


    console.log(oneTimePassword);
    console.log("is verified", oneTimePassword.isVerified());
    console.log("is isValid", oneTimePassword.isValid());

    if (!oneTimePassword || !oneTimePassword.isValid() || oneTimePassword.isVerified() || oneTimePassword.phoneOrEmail !== email || oneTimePassword.target !== "EMAIL") throw new BadRequestException({
      code: "invalid_signature",
      message: "Access denied due to invalid signature. Please check your signature and try again."
    });

    if (oneTimePassword.attempts >= 10) throw new HttpException({
      code: "to_many_attempts",
      message: "You have made too many attempts to verify signature."
    }, HttpStatus.TOO_MANY_REQUESTS);

    oneTimePassword.attempts++;

    const codeVerify = await verify(oneTimePassword.hashCode, String(code), {
      version: argon2id
    });

    if (!codeVerify) {
      await this.cache.set(`otp:${signature}`, oneTimePassword, VerificationService.ONE_TIME_PASSWORD_EXPIRATION_MS - (Date.now() - oneTimePassword.createdTimestampAt * 1000));
      throw new BadRequestException({
        code: "incorrect_verification_code",
        message: "The verification code you entered is invalid. Please check and try again."
      });
    }

    oneTimePassword.verify();
    await this.cache.set(`otp:${signature}`, oneTimePassword, VerificationService.ONE_TIME_PASSWORD_VERIFIED_EXPIRATION_MS);

  }

}
