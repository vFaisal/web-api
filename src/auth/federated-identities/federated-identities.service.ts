import {
  BadRequestException,
  CACHE_MANAGER,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { Provider, SessionType } from "@prisma/client";
import { generateNanoId, SignificantRequestInformation, unixTimestamp } from "../../utils/util";
import { AuthService } from "../auth.service";
import { Cache } from "cache-manager";
import FederatedIdentityRegistrationEntity from "./entities/federated-identity-registration.entity";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import { AccountEntity } from "../../account/entities/account.entity";

@Injectable()
export class FederatedIdentitiesService {

  private static readonly REGISTRATION_SIGNATURE_EXPIRATION_MS = 60 * 15 * 1000; // 15 min

  constructor(private prisma: PrismaService, private authService: AuthService, @Inject(CACHE_MANAGER) private cache: Cache) {
  }

  public async authenticate(email: string, userId: string, provider: Provider, photoUrl: string, signatureRequestInformation: SignificantRequestInformation) {
    const existAccount = await this.prisma.accountFederatedIdentities.findUnique({
      where: {
        provider_userId: {
          provider,
          userId
        }
      },
      select: {
        account: true
      }
    });
    if (existAccount)
      return {
        auth: "LOGIN",
        provider,
        credentials: this.authService.createCredentials(existAccount.account, signatureRequestInformation, SessionType.FEDERATED_IDENTITY)
      };
    //Check if there email associated with this email;
    const account = await this.prisma.account.findUnique({
      where: {
        email
      },
      select: {
        id: true
      }
    });

    if (account) throw new BadRequestException({
      code: "email_already_registered",
      message: "The email provided is already registered with an existing account. Please use a different Google account or log in with your existing account by email and link your Google account to your account to able login using Google account."
    });

    const signature = generateNanoId(128);
    await this.cache.set(`federatedIdentityRegistration:${signature}`, new FederatedIdentityRegistrationEntity<"CREATION">({
      userId,
      provider,
      email,
      photoUrl,
      signature,
      createdTimestampAt: unixTimestamp()
    }), FederatedIdentitiesService.REGISTRATION_SIGNATURE_EXPIRATION_MS);

    return {
      auth: "REGISTRATION",
      provider,
      signature
    };
  }

  public async registration(signature: string, provider: Provider) {
    const registration = new FederatedIdentityRegistrationEntity<"GET">(await this.cache.get(`federatedIdentityRegistration:${signature}`));

    if (!registration.isValid() || provider !== registration.provider) throw new BadRequestException({
      code: "invalid_signature",
      message: "Access denied due to invalid signature. Please check your signature and try again."
    });

    const account = await this.prisma.account.create({
      data: {
        email: registration.email,
        publicId: generateNanoId(),
        federatedIdentities: {
          create: {
            email: registration.email,
            userId: registration.userId,
            provider
          }
        }
      },
      include: {
        federatedIdentities: true
      }
    }).catch((err: PrismaClientKnownRequestError) => {
      if (err.code == "P2002") throw new ConflictException({
        code: "email_already_registered",
        message: "The email provided is already registered with an existing account. Please use a different Google account or log in with your existing account by email and link your Google account to your account to able login using Google account."
      });
      throw new ServiceUnavailableException();
    });


    return new AccountEntity(account, account.federatedIdentities);
  }

}
