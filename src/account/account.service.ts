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
import PhoneVerificationGlobalService from '../core/services/phone-verification.global.service';
import EmailVerificationGlobalService from '../core/services/email-verification.global.service';
import { ActivityAction, ActivityOperationType, Prisma } from '@prisma/client';
import UpdatePasswordDto from './dto/update-password.dto';
import { argon2id, hash, verify } from 'argon2';
import ThrottlerService from '../core/security/throttler.service';
import UpdateAccountDto from './dto/update-account.dto';
import OpenaiService from '../core/providers/openai.service';
import PasswordValidationGlobalService from '../core/services/password-validation.global.service';
import AccountActivityGlobalService from '../core/services/account-activity.global.service';
import SessionGlobalService from '../core/services/session.global.service';

@Injectable()
export class AccountService {
  private readonly logger: Logger = new Logger('AccountService');

  private static readonly ALLOWED_UPDATE_EMAIL_AFTER = 14 * 24 * 60 * 60 * 1000; // 14days (Milliseconds);
  private static readonly ATTEMPTS_UPDATE_PASSWORD_LIMIT = 15;
  private static readonly ATTEMPTS_UPDATE_PASSWORD_TTL = 15 * 60;

  private static readonly ATTEMPTS_UPDATE_DISPLAY_NAME_LIMIT = 15;
  private static readonly ATTEMPTS_UPDATE_DISPLAY_NAME_TTL = 2 * 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly kv: RedisService,
    private readonly twilioService: TwilioService,
    private readonly phoneVerificationService: PhoneVerificationGlobalService,
    private readonly emailVerificationService: EmailVerificationGlobalService,
    private readonly throttler: ThrottlerService,
    private readonly openai: OpenaiService,
    private readonly passwordValidation: PasswordValidationGlobalService,
    private readonly accountActivityService: AccountActivityGlobalService,
    private readonly sessionService: SessionGlobalService,
  ) {}

  public async getSafeAccountData(id: bigint) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: id,
      },
      include: {
        federatedIdentities: true,
      },
    });
    return new AccountEntity(account, account.federatedIdentities);
  }

  public async uploadPhoto(
    file: MultipartFile,
    session: SessionEntity,
    sri: SignificantRequestInformation,
  ) {
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

    this.accountActivityService.create(
      session,
      sri,
      account.photoHash
        ? ActivityOperationType.UPDATE
        : ActivityOperationType.CREATE,
      account.photoHash
        ? ActivityAction.PHOTO_UPDATED
        : ActivityAction.PHOTO_ADDED,
    );

    return {
      url: R2Service.PUBLIC_CDN_DOMAIN + '/' + generatedImageId,
    };
  }

  public async deletePhoto(
    session: SessionEntity,
    sri: SignificantRequestInformation,
  ) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
      select: {
        photoHash: true,
      },
    });
    if (!account.photoHash)
      throw new BadRequestException({
        code: 'account_photo_not_found',
        message:
          'Deletion of the account photo cannot be processed because there is no photo associated with the account.',
      });
    await this.r2.delete(account.photoHash);
    await this.prisma.account.updateMany({
      data: {
        photoHash: null,
      },
      where: {
        id: session.getAccount().id,
      },
    });

    this.accountActivityService.create(
      session,
      sri,
      ActivityOperationType.DELETE,
      ActivityAction.PHOTO_DELETED,
    );
  }

  public async deletePhone(
    session: SessionEntity,
    sri: SignificantRequestInformation,
  ) {
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

    this.accountActivityService.create(
      session,
      sri,
      ActivityOperationType.DELETE,
      ActivityAction.PHONE_DELETE,
      [
        {
          key: 'oldPhoneNumber',
          value: safeAccountData.phone.number,
        },
        {
          key: 'oldPhoneCallingCode',
          value: safeAccountData.phone.prefix.replace('+', ''),
        },
      ],
    );
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
      throw new ConflictException({
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

    const phoneVerification = await this.phoneVerificationService.start(
      session.getAccount().id,
      {
        number: phoneNumber,
        countryCallingCode: parsedPhoneNumber.calling_country_code,
      },
      channel,
      'updatePhone',
    );

    return phoneVerification;
  }

  public async verifyPhone(
    session: SessionEntity,
    sri: SignificantRequestInformation,
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

    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    const safeAccountData = new AccountEntity(account);

    await this.prisma.account
      .updateMany({
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
      })
      .catch((err: Prisma.PrismaClientKnownRequestError) => {
        if (err.code == 'P2002')
          throw new ConflictException({
            code: 'phone_number_already_linked',
            message:
              'The phone number provided is already associated with another account.',
          });
        throw new ServiceUnavailableException();
      });

    this.accountActivityService.create(
      session,
      sri,
      safeAccountData.havePhoneNumber()
        ? ActivityOperationType.UPDATE
        : ActivityOperationType.CREATE,
      safeAccountData.havePhoneNumber()
        ? ActivityAction.PHONE_UPDATED
        : ActivityAction.PHONE_ADDED,
      safeAccountData.havePhoneNumber()
        ? [
            {
              key: 'oldPhoneNumber',
              value: safeAccountData.phone.number,
            },
            {
              key: 'oldPhoneCallingCode',
              value: safeAccountData.phone.prefix.replace('+', ''),
            },
          ]
        : [],
    );
  }

  public async resendPhoneVerification(
    session: SessionEntity,
    internationalPhoneNumber: string,
    token: string,
    channel: VerificationChannel,
  ) {
    return this.phoneVerificationService.resend(
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

    return  this.emailVerificationService.start(
      email,
      {
        type: 'account',
        identifier: account.id,
      },
      'updateEmail',
      this.getUpdateEmailMessage(safeAccountDate, sri),
    );

  }

  public async verifyUpdateEmail(
    session: SessionEntity,
    sri: SignificantRequestInformation,
    token: string,
    email: string,
    code: string,
  ) {
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

    const verification = await this.emailVerificationService.verify(
      code,
      token,
      email,
      'updateEmail',
      session.getAccount().id,
    );

    await this.sessionService.revokeAllActiveSession(session.getAccount().id, {
      excluded: [session.getPrimaryPublicId()],
      throwIfNoActiveSessions: false,
    });

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

    this.accountActivityService.create(
      session,
      sri,
      ActivityOperationType.UPDATE,
      ActivityAction.EMAIL_UPDATED,
      [
        {
          key: 'oldEmail',
          value: account.email,
        },
      ],
    );
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

  public async updatePassword(
    session: SessionEntity,
    sri: SignificantRequestInformation,
    d: UpdatePasswordDto,
  ) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });
    const safeAccountData = new AccountEntity(account);

    await this.passwordValidation.validatePasswordIfRateLimitedRevokeSession(
      session,
      account,
      d.currentPassword,
    );

    await this.sessionService.revokeAllActiveSession(session.getAccount().id, {
      excluded: [session.getPrimaryPublicId()],
      throwIfNoActiveSessions: false,
    });

    await this.prisma.account.updateMany({
      where: {
        id: session.getAccount().id,
      },
      data: {
        passwordHash: await hash(d.newPassword, {
          version: argon2id,
        }),
        passwordLoginUnlocked:
          account.passwordLoginUnlocked?.getTime() > Date.now()
            ? new Date()
            : undefined,
      },
    });

    this.accountActivityService.create(
      session,
      sri,
      safeAccountData.isPasswordLess()
        ? ActivityOperationType.CREATE
        : ActivityOperationType.UPDATE,
      safeAccountData.isPasswordLess()
        ? ActivityAction.PASSWORD_ADDED
        : ActivityAction.PASSWORD_UPDATED,
      !safeAccountData.isPasswordLess()
        ? [
            {
              key: 'oldPasswordHash',
              value: account.passwordHash,
            },
          ]
        : [],
    );
  }

  public async update(
    session: SessionEntity,
    sri: SignificantRequestInformation,
    d: UpdateAccountDto,
  ) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
    });

    if (
      account.displayName?.trim().toLowerCase() !==
      d.displayName.trim().toLowerCase()
    ) {
      //Rete-limit
      await this.throttler.throwIfRateLimited(
        'updateDisplayName',
        AccountService.ATTEMPTS_UPDATE_DISPLAY_NAME_TTL,
        AccountService.ATTEMPTS_UPDATE_DISPLAY_NAME_LIMIT,
        'account',
      );

      const moderation = await this.openai.moderation(d.displayName.trim());
      if (moderation.flagged)
        throw new BadRequestException({
          code: 'offensive_display_name',
          message:
            'The display name is offensive in nature and cannot be used. Please provide a non-offensive display name.',
        });

      await this.prisma.account.updateMany({
        where: {
          id: session.getAccount().id,
        },
        data: {
          displayName: d.displayName.trim(),
        },
      });

      if (
        account.displayName?.trim().toLowerCase() !==
        d.displayName.trim().toLowerCase()
      )
        this.accountActivityService.create(
          session,
          sri,
          ActivityOperationType.UPDATE,
          ActivityAction.ACCOUNT_DATA_UPDATED,
          [
            {
              key: 'oldDisplayName',
              value: account.displayName,
            },
          ],
        );
    }
  }

  public async deleteAccount(session: SessionEntity) {
    await this.sessionService.revokeAllActiveSession(session.getAccount().id, {
      excluded: [],
      throwIfNoActiveSessions: false,
    });

    await this.prisma.account.delete({
      where: {
        id: session.getAccount().id,
      },
    });
  }
}
