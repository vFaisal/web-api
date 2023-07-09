import {
  BadRequestException,
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
import { nanoid } from 'nanoid';
import { generateNanoId, unixTimestamp } from '../core/utils/util';
import SessionEntity from '../auth/entities/session.entity';
import TwilioService, {
  VerificationChannel,
} from '../core/providers/twilio.service';
import RedisService from '../core/providers/redis.service';
import PhoneVerificationService from '../core/services/phone-verification.service';

@Injectable()
export class AccountService {
  private readonly logger: Logger = new Logger('AccountService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly kv: RedisService,
    private readonly twilioService: TwilioService,
    private readonly phoneVerificationService: PhoneVerificationService,
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

  public async startPhoneVerification(
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
          'The phone number provided is already associated with another account. Please use a different phone number or contact support for further assistance.',
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
    );

    return {
      phone: {
        countryCode: parsedPhoneNumber.country_code,
        countryCallingCode: parsedPhoneNumber.calling_country_code,
        nationalNumber: parsedPhoneNumber.phone_number.replace(' ', ''),
      },
      token: verificationToken,
      timestampExpires: unixTimestamp(
        PhoneVerificationService.VERIFICATION_EXPIRATION,
      ),
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
    );
  }
}
