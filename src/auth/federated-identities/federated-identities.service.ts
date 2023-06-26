import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../core/providers/prisma.service';
import { Provider, SessionType } from '@prisma/client';
import {
  capitalize,
  generateNanoId,
  SignificantRequestInformation,
  unixTimestamp,
} from '../../core/utils/util';
import { AuthService } from '../auth.service';
import FederatedIdentityRegistrationEntity from './entities/federated-identity-registration.entity';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { AccountEntity } from '../../account/entities/account.entity';
import RedisService from '../../core/providers/redis.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class FederatedIdentitiesService {
  private static readonly REGISTRATION_SIGNATURE_EXPIRATION = 60 * 15; // 15 min

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private jwt: JwtService,
    private kv: RedisService,
  ) {}

  public getUserInfoByDecodingIdToken(token: string): any {
    return this.jwt.decode(token);
  }

  public async authenticate(
    email: string,
    userId: string,
    provider: Provider,
    photoUrl: string,
    displayName: string,
    signatureRequestInformation: SignificantRequestInformation,
  ) {
    if (!email || !userId) throw new ServiceUnavailableException();

    const existAccount =
      await this.prisma.accountFederatedIdentities.findUnique({
        where: {
          provider_userId: {
            provider,
            userId,
          },
        },
        select: {
          account: true,
        },
      });
    if (existAccount)
      return {
        auth: 'login',
        provider: provider.toLowerCase(),
        credentials: await this.authService.createCredentials(
          existAccount.account,
          signatureRequestInformation,
          SessionType.FEDERATED_IDENTITY,
        ),
      };
    //Check if there email associated with this email;
    const account = await this.prisma.account.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (account)
      throw new BadRequestException({
        code: 'email_already_registered',
        message: `You cannot login or register using your ${capitalize(
          provider,
        )} Account because the email address within it is already linked to another account registered with our service. Since there is no existing link between your ${capitalize(
          provider,
        )} Account and the appropriate association, it is not possible to use that ${capitalize(
          provider,
        )} Account for login or registration.`,
      });

    const signature = generateNanoId(64);
    await this.kv.setex(
      `federatedIdentityRegistration:${signature}`,
      FederatedIdentitiesService.REGISTRATION_SIGNATURE_EXPIRATION,
      new FederatedIdentityRegistrationEntity<'CREATION'>({
        userId,
        provider,
        email,
        signature,
        createdTimestampAt: unixTimestamp(),
      }),
    );

    return {
      auth: 'registration',
      provider: provider.toLowerCase(),
      user: {
        email,
        photo: photoUrl ?? null,
        displayName: displayName ?? null,
      },
      signature,
      expires: unixTimestamp(
        FederatedIdentitiesService.REGISTRATION_SIGNATURE_EXPIRATION,
      ),
    };
  }

  public async registration(
    signature: string,
    email: string,
    significantRequestInformation: SignificantRequestInformation,
  ) {
    const registration = new FederatedIdentityRegistrationEntity<'GET'>(
      await this.kv.get(`federatedIdentityRegistration:${signature}`),
    );

    if (!registration.isValid() || registration.email !== email)
      throw new BadRequestException({
        code: 'invalid_signature',
        message:
          'Access denied due to invalid signature. Please check your signature and try again.',
      });

    const account = await this.prisma.account
      .create({
        data: {
          email: registration.email,
          emailVerifiedAt: new Date(),
          countryCode: 'SA',
          publicId: generateNanoId(),
          federatedIdentities: {
            create: {
              email: registration.email,
              userId: registration.userId,
              provider: registration.provider,
            },
          },
        },
        include: {
          federatedIdentities: true,
        },
      })
      .catch((err: PrismaClientKnownRequestError) => {
        if (err.code == 'P2002')
          throw new ConflictException({
            code: 'email_already_registered',
            message: `You cannot login or register using your ${capitalize(
              registration.provider,
            )} Account because the email address within it is already linked to another account registered with our service. Since there is no existing link between your ${capitalize(
              registration.provider,
            )} Account and the appropriate association, it is not possible to use that ${capitalize(
              registration.provider,
            )} Account for login or registration.`,
          });
        throw new ServiceUnavailableException();
      });

    return {
      account: new AccountEntity(account, account.federatedIdentities),
      credentials: await this.authService.createCredentials(
        account,
        significantRequestInformation,
        SessionType.FEDERATED_IDENTITY,
      ),
    };
  }
}
