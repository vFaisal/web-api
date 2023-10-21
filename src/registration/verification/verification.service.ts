import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/providers/prisma.service';
import RedisService from '../../core/providers/redis.service';
import {
  RegistrationCache,
  RegistrationService,
} from '../registration.service';
import EmailVerificationGlobalService from '../../core/services/email-verification.global.service';
import VerifyEmailDto from './dto/verify-email.dto';
import ResendEmailVerificationDto from './dto/resend-email-verification.dto';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailVerificationService: EmailVerificationGlobalService,
    private readonly kv: RedisService,
  ) {}

  private get emailVerificationMessage() {
    return {
      subject: 'Email verification',
      description:
        'Dear User,\n' +
        '\n' +
        'Thank you for creating an account with us. To ensure the security of your information, we require email verification. Please enter the following 6-digit code on our website to proceed:\n' +
        '\n' +
        'Verification Code: ' +
        '######',
    };
  }

  public async createEmailVerification(email: string, ip: string) {
    const existAccount = await this.prisma.account.findUnique({
      where: {
        email: email,
      },
      select: {
        id: true,
      },
    });
    if (existAccount)
      throw new ConflictException({
        code: 'email_already_registered',
        message:
          'Email address is already associated with an existing account. Please login or use a different email address to create a new account.',
      });

    const token = await this.emailVerificationService.start(
      email,
      {
        type: 'ip',
        identifier: ip,
      },
      'registration',
      this.emailVerificationMessage,
      64,
    );

    return {
      token,
    };
  }

  public async resendEmailVerification(
    d: ResendEmailVerificationDto,
    token: string,
  ) {
    return this.emailVerificationService.resend(
      token,
      d.email,
      'registration',
      this.emailVerificationMessage,
    );
  }

  public async verifyEmail(d: VerifyEmailDto, token: string) {
    await this.emailVerificationService.verify(
      d.code,
      token,
      d.email,
      'registration',
    );

    await this.kv.setex<RegistrationCache>(
      `registration:${token}`,
      RegistrationService.SIGNATURE_REGISTRATION_EXPIRATION,
      {
        email: d.email,
      },
    );
  }
}
