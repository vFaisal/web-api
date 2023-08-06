import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../core/providers/prisma.service';
import RegistrationDto from './dto/registration.dto';
import {
  generateNanoId,
  SignificantRequestInformation,
} from '../core/utils/util';
import { argon2id, hash } from 'argon2';
import { Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { SessionType } from '@prisma/client';
import { AccountEntity } from '../account/entities/account.entity';
import RedisService from '../core/providers/redis.service';

@Injectable()
export class RegistrationService {
  public static readonly SIGNATURE_REGISTRATION_EXPIRATION = 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private authService: AuthService,
    private kv: RedisService,
  ) {}

  public async createAccountWithEmail(
    params: RegistrationDto,
    significantRequestInformation: SignificantRequestInformation,
  ) {
    const registration = await this.kv.get<RegistrationCache>(
      `registration:${params.signature}`,
    );

    if (!registration || registration.email !== params.email)
      throw new BadRequestException({
        code: 'invalid_signature',
        message:
          'Access denied due to invalid signature. Please check your signature and try again.',
      });

    await this.kv.del(`registration:${params.signature}`);

    const account = await this.prisma.account
      .create({
        data: {
          countryCode: 'SA',
          emailVerifiedAt: new Date(),
          email: registration.email,
          passwordHash: await hash(params.password, {
            version: argon2id,
          }),
          publicId: generateNanoId(),
        },
      })
      .catch((err: Prisma.PrismaClientKnownRequestError) => {
        if (err.code == 'P2002')
          throw new ConflictException({
            code: 'email_already_registered',
            message:
              'Email address is already associated with an existing account. Please login or use a different email address to create a new account.',
          });
        throw new ServiceUnavailableException();
      });

    return {
      account: new AccountEntity(account),
      credentials: await this.authService.createCredentials(
        account,
        significantRequestInformation,
        SessionType.EMAIL,
      ),
    };
  }
}

export interface RegistrationCache {
  email: string;
}
