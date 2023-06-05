import {
  BadRequestException,
  ConflictException,
  HttpException, HttpStatus,
  Injectable
} from "@nestjs/common";
import { PrismaService } from "../../providers/prisma.service";
import { generateNanoId, unixTimestamp } from "../../utils/util";
import { randomInt } from "crypto";
import { hash, verify, argon2id } from "argon2";
import OneTimePasswordEntity from "./entities/one-time-password.entity";
import RedisService from "../../providers/redis.service";
import { RegistrationService } from "../registration.service";
import RegistrationEntity from "../entities/registration.entity";
import { ConfigService } from "@nestjs/config";
import SendgridService from "../../providers/sendgrid.service";

@Injectable()
export class VerificationService {

  private static readonly ONE_TIME_PASSWORD_EXPIRATION = 60 * 15;
  private static readonly DEFAULT_ALLOWED_ATTEMPTS = 10;

  constructor(private readonly prisma: PrismaService, private readonly kv: RedisService, private readonly config: ConfigService, private readonly sendgrid: SendgridService) {
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
      code: "email_already_registered",
      message: "Email address is already associated with an existing account. Please login or use a different email address to create a new account."
    });
    const randomDigit = randomInt(100_000, 999_999);
    const signature = generateNanoId(64);


    await this.kv.setex(`otp:${signature}`, VerificationService.ONE_TIME_PASSWORD_EXPIRATION, new OneTimePasswordEntity<"CREATION">({
      phoneOrEmail: email,
      target: "EMAIL",
      intent: "REGISTRATION",
      signature,
      hashCode: await hash(String(randomDigit), {
        version: argon2id
      }),
      attempts: 0,
      createdTimestampAt: unixTimestamp()
    }));

    if (this.config.get("NODE_ENV") == "production") {
      this.sendgrid.sendEmail(email, "Email verification", {
        type: "text/plain",
        value: "Dear User,\n" +
          "\n" +
          "Thank you for creating an account with us. To ensure the security of your information, we require email verification. Please enter the following 6-digit code on our website to proceed:\n" +
          "\n" +
          "Verification Code: " + randomDigit
      });
    }

    console.log("Verification Code: ", randomDigit);
    return {
      signature
    };
  }

  public async verifyEmail({ email, signature, code }: { email: string, signature: string, code: number }) {
    let oneTimePassword = new OneTimePasswordEntity<"GET">(await this.kv.get(`otp:${signature}`));

    if (!oneTimePassword.isValid() || oneTimePassword.phoneOrEmail !== email || oneTimePassword.target !== "EMAIL") throw new BadRequestException({
      code: "invalid_signature",
      message: "Access denied due to invalid signature. Please check your signature and try again."
    });

    if (oneTimePassword.attempts >= VerificationService.DEFAULT_ALLOWED_ATTEMPTS) throw new HttpException({
      code: "to_many_attempts",
      message: "You have made too many attempts to verify signature."
    }, HttpStatus.TOO_MANY_REQUESTS);

    oneTimePassword.attempts++;

    const codeVerify = await verify(oneTimePassword.hashCode, String(code), {
      version: argon2id
    });

    if (!codeVerify) {
      await this.kv.setex(`otp:${signature}`, VerificationService.ONE_TIME_PASSWORD_EXPIRATION - (unixTimestamp() - oneTimePassword.createdTimestampAt), oneTimePassword);
      throw new BadRequestException({
        code: "incorrect_verification_code",
        message: "The verification code you entered is invalid. Please check and try again."
      });
    }

    await this.kv.del(`otp:${signature}`);

    await this.kv.setex(`registration:${signature}`, RegistrationService.SIGNATURE_REGISTRATION_EXPIRATION, new RegistrationEntity<"CREATION">({
      phoneOrEmail: oneTimePassword.phoneOrEmail,
      target: "EMAIL",
      signature,
      createdTimestampAt: unixTimestamp()
    }));

  }

}
