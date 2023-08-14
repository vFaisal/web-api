import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PrismaService } from '../core/providers/prisma.service';
import { AccountEntity } from './entities/account.entity';
import { MultipartFile } from '@fastify/multipart';
import R2Service from '../core/providers/r2.service';
import {
  generateNanoId,
  requesterInformationAsEmail,
  SignificantRequestInformation,
  unixTimestamp,
} from '../core/utils/util';
import SessionEntity from '../auth/entities/session.entity';
import TwilioService, {
  VerificationChannel,
} from '../core/providers/twilio.service';
import RedisService from '../core/providers/redis.service';
import PhoneVerificationService from '../core/services/phone-verification.service';
import EmailVerificationService from '../core/services/email-verification.service';
import { Prisma } from '@prisma/client';
import UpdatePasswordDto from './dto/update-password.dto';
import { argon2id, hash, verify } from 'argon2';
import ThrottlerService from '../core/security/throttler.service';

@Injectable()
export class AccountService {
  private readonly logger: Logger = new Logger('AccountService');

  private static readonly UPDATE_EMAIL_PERIOD = 10 * 60; // 10min (Seconds)
  private static readonly ALLOWED_UPDATE_EMAIL_AFTER = 14 * 24 * 60 * 60 * 1000; // 14days (Milliseconds);
  private static readonly ATTEMPTS_UPDATE_PASSWORD_LIMIT = 15;
  private static readonly ATTEMPTS_UPDATE_PASSWORD_TTL = 15 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly kv: RedisService,
    private readonly twilioService: TwilioService,
    private readonly phoneVerificationService: PhoneVerificationService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly throttler: ThrottlerService,
  ) {}

  public async getSafeAccountData(id: bigint) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: id,
      },
    });
    return new AccountEntity(account);
  }

  public async uploadPhoto(file: MultipartFile, session: SessionEntity) {
    if (!R2Service.SUPPORTED_IMAGE_MIMETYPE.includes(file.mimetype))
      throw new UnsupportedMediaTypeException({
        code: 'unsupported_file_type',
        message: 'Unsupported file type.',
      });

    const bufferFile = await file.toBuffer();

    if (bufferFile.length > R2Service.MAX_SIZE)
      throw new PayloadTooLargeException({
        code: 'max_size_exceeded',
        message: `File size exceeds the maximum supported limit of ${
          R2Service.MAX_SIZE / 1024 / 1024
        }MB.`,
      });

    const generatedImageId = generateNanoId(32);

    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
      select: {
        photoHash: true,
      },
    });

    if (account.photoHash) await this.r2.delete(account.photoHash);

    await this.r2.upload(bufferFile, generatedImageId);

    await this.prisma.account.updateMany({
      data: {
        photoHash: generatedImageId,
      },
      where: {
        id: session.getAccount().id,
      },
    });

    return {
      url: R2Service.PUBLIC_CDN_DOMAIN + '/' + generatedImageId,
    };
  }

  public async deletePhoto(session: SessionEntity) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
      select: {
        photoHash: true,
      },
    });
    if (account.photoHash) {
      await this.r2.delete(account.photoHash);
      await this.prisma.account.updateMany({
        data: {
          photoHash: null,
        },
        where: {
          id: session.getAccount().id,
        },
      });
    }
  }

  public async deletePhone(session: SessionEntity) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    const safeAccountData = new AccountEntity(account);
    if (!safeAccountData.havePhoneNumber())
      throw new BadRequestException({
        code: 'phone_number_absent',
        message: 'The account does not have a registered phone number',
      });

    await this.prisma.account.updateMany({
      where: {
        id: session.getAccount().id,
      },
      data: {
        phoneNumber: null,
        phoneCountryCode: null,
        phoneVerifiedAt: null,
        mfaSMS: null,
        mfaWhatsapp: null,
      },
    });
  }

  public async updatePhone(
    session: SessionEntity,
    internationalPhoneNumber: string,
    channel: VerificationChannel,
  ) {
    const parsedPhoneNumber = await this.twilioService.validatePhoneNumber(
      internationalPhoneNumber,
    );
    if (!parsedPhoneNumber.valid)
      throw new BadRequestException({
        code: 'invalid_phone_number',
        message:
          'The phone number provided is invalid. Please ensure you have entered a valid phone number and try again.',
      });

    const phoneNumber = internationalPhoneNumber.replace(
      '+' + parsedPhoneNumber.calling_country_code,
      '',
    );

    const phoneNumberLinked = await this.prisma.account.findUnique({
      where: {
        phoneCountryCode_phoneNumber: {
          phoneNumber: phoneNumber,
          phoneCountryCode: parsedPhoneNumber.calling_country_code,
        },
      },
    });
    if (phoneNumberLinked)
      throw new BadRequestException({
        code: 'phone_number_already_linked',
        message:
          'The phone number provided is already associated with another account.',
      });

    /*    await this.prisma.account.updateMany({
          data: {
            phoneNumber: phoneNumber,
            phoneCountryCode: parsedPhoneNumber.calling_country_code,
            phoneVerifiedAt: null,
          },
          where: {
            id: session.getAccount().id,
          },
        });*/

    const verificationToken = await this.phoneVerificationService.start(
      session.getAccount().id,
      {
        number: phoneNumber,
        countryCallingCode: parsedPhoneNumber.calling_country_code,
      },
      channel,
      'updatePhone',
    );

    return {
      phone: {
        countryCode: parsedPhoneNumber.country_code,
        countryCallingCode: parsedPhoneNumber.calling_country_code,
        nationalNumber: parsedPhoneNumber.phone_number.replace(' ', ''),
      },
      token: verificationToken,
      expires: unixTimestamp(PhoneVerificationService.VERIFICATION_EXPIRATION),
    };
  }

  public async verifyPhone(
    session: SessionEntity,
    internationalPhoneNumber: string,
    token: string,
    code: string,
  ) {
    const verification = await this.phoneVerificationService.verify(
      internationalPhoneNumber,
      session.getAccount().id,
      token,
      code,
      'updatePhone',
    );

    await this.prisma.account.updateMany({
      data: {
        phoneNumber: verification.cache.phone.number,
        phoneCountryCode: verification.cache.phone.countryCallingCode,
        phoneVerifiedAt: new Date(),
        mfaSMS: null,
        mfaWhatsapp: null,
      },
      where: {
        id: session.getAccount().id,
      },
    });
  }

  public async resendPhoneVerification(
    session: SessionEntity,
    internationalPhoneNumber: string,
    token: string,
    channel: VerificationChannel,
  ) {
    await this.phoneVerificationService.resend(
      internationalPhoneNumber,
      session.getAccount().id,
      token,
      channel,
      'updatePhone',
    );
  }

  public getUpdateEmailMessage(
    safeAccountDate: AccountEntity,
    sri: SignificantRequestInformation,
  ) {
    return {
      subject: 'Email Change Verification',
      description:
        `Hello ${safeAccountDate.displayName ?? ''},\n` +
        '\n' +
        "We are reaching out to you to confirm the recent request to update your email address for your account. Your account's security is our top concern, and we want to ensure the validity of this change.\n" +
        'To finalize the email address update, please input the 6-digit verification code provided below:\n' +
        '\n' +
        'Verification Code: ###### (This code is only valid for 10 minutes.)\n\n' +
        'Requester Information:\n' +
        requesterInformationAsEmail(sri),
    };
  }

  public async updateEmail(
    email: string,
    session: SessionEntity,
    sri: SignificantRequestInformation,
  ) {
    const existEmail = await this.prisma.account.findUnique({
      where: {
        email: email,
      },
    });
    if (existEmail)
      throw new BadRequestException({
        code: 'email_already_registered',
        message:
          'The provided email address is already associated with an existing account.',
      });

    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });

    if (
      account.emailVerifiedAt &&
      account.emailVerifiedAt.getTime() +
        AccountService.ALLOWED_UPDATE_EMAIL_AFTER >=
        Date.now()
    )
      throw new BadRequestException({
        code: 'email_update_temporarily_unavailable',
        message:
          'Email address updates are restricted to once every 14 days. You can update your email again after the cooldown period.',
      });

    const safeAccountDate = new AccountEntity(account);

    const verificationToken = await this.emailVerificationService.start(
      email,
      {
        type: 'account',
        identifier: account.id,
      },
      'updateEmail',
      this.getUpdateEmailMessage(safeAccountDate, sri),
    );

    return {
      token: verificationToken,
      expires: unixTimestamp(AccountService.UPDATE_EMAIL_PERIOD),
    };
  }

  public async verifyUpdateEmail(
    session: SessionEntity,
    token: string,
    email: string,
    code: string,
  ) {
    const verification = await this.emailVerificationService.verify(
      code,
      token,
      email,
      'updateEmail',
      session.getAccount().id,
    );

    await this.prisma.account
      .updateMany({
        data: {
          email: verification.email,
          emailVerifiedAt: new Date(),
        },
        where: {
          id: session.getAccount().id,
        },
      })
      .catch((err: Prisma.PrismaClientKnownRequestError) => {
        if (err.code == 'P2002')
          throw new ConflictException({
            code: 'email_already_registered',
            message:
              'Email address is already associated with an existing account.',
          });
        throw new ServiceUnavailableException();
      });
  }

  public async resendUpdateEmail(
    session: SessionEntity,
    email: string,
    token: string,
    sri: SignificantRequestInformation,
  ) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    const safeAccountData = new AccountEntity(account);
    return this.emailVerificationService.resend(
      token,
      email,
      'updateEmail',
      this.getUpdateEmailMessage(safeAccountData, sri),
      session.getAccount().id,
    );
  }

  public async updatePassword(session: SessionEntity, d: UpdatePasswordDto) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });

    await this.throttler.throwIfRateLimited(
      'updatePasswordAttempts:' + session.getAccount().id,
      AccountService.ATTEMPTS_UPDATE_PASSWORD_TTL,
      AccountService.ATTEMPTS_UPDATE_PASSWORD_LIMIT,
      'account',
    );

    const isVerifiedPassword = await verify(
      account.passwordHash,
      d.currentPassword,
      {
        version: argon2id,
      },
    );
    if (!isVerifiedPassword) {
      throw new BadRequestException({
        code: 'current_password_mismatch',
        message:
          "The current password you provided does not match your account's current password.",
      });
    }

    this.prisma.account.updateMany({
      where: {
        id: session.getAccount().id,
      },
      data: {
        passwordHash: await hash(d.newPassword, {
          version: argon2id,
        }),
      },
    });
  }
}
