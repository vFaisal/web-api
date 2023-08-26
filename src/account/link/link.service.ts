import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleService } from '../../auth/federated-identities/google/google.service';
import { FastifyReply, FastifyRequest } from 'fastify';
import CSRFService from '../../core/security/csrf.service';
import PKCEService from '../../core/security/pkce.service';
import RedisService from '../../core/providers/redis.service';
import SessionEntity from '../../auth/entities/session.entity';
import { Prisma, Provider } from '@prisma/client';
import {
  FederatedIdentitiesService,
  OAuth2Data,
} from '../../auth/federated-identities/federated-identities.service';
import { PrismaService } from '../../core/providers/prisma.service';
import { capitalize } from '../../core/utils/util';
import { FacebookService } from '../../auth/federated-identities/facebook/facebook.service';
import { MicrosoftService } from '../../auth/federated-identities/microsoft/microsoft.service';
import { GithubService } from '../../auth/federated-identities/github/github.service';
import { TwitterService } from '../../auth/federated-identities/twitter/twitter.service';
import { AccountEntity } from '../entities/account.entity';

@Injectable()
export class LinkService {
  public static readonly EXPIRATION = 60 * 15;

  constructor(
    private readonly googleService: GoogleService,
    private readonly facebookService: FacebookService,
    private readonly microsoftService: MicrosoftService,
    private readonly githubService: GithubService,
    // private readonly twitterService: TwitterService,
    private readonly federatedIdentitiesService: FederatedIdentitiesService,
    private readonly prismaService: PrismaService,
    private readonly csrfService: CSRFService,
    private readonly pkceService: PKCEService,
    private readonly kv: RedisService,
  ) {}

  private redirectUri(provider: Provider) {
    return `https://api.faisal.gg/v1/account/link/${provider.toLowerCase()}/callback`;
  }

  public async redirect(
    session: SessionEntity,
    provider: Provider,
    req: FastifyRequest,
    res: FastifyReply,
  ) {
    // @ts-ignore
    provider = provider.toUpperCase();
    const state = await this.csrfService.create(req, res, 'link');

    await this.kv.setex(
      'link:' + state,
      LinkService.EXPIRATION,
      String(session.getAccount().id),
    );

    const uri: string | null =
      provider === Provider.GOOGLE
        ? this.googleService.redirectAuthEndpointUrl(
            state,
            this.pkceService.enforcePKCE(res, req),
            this.redirectUri(provider),
          )
        : provider === Provider.META
        ? this.facebookService.redirectAuthEndpointUrl(
            state,
            this.pkceService.enforcePKCE(res, req),
            this.redirectUri(provider),
          )
        : provider === Provider.MICROSOFT
        ? this.microsoftService.redirectAuthEndpointUrl(
            state,
            this.pkceService.enforcePKCE(res, req),
            this.redirectUri(provider),
          )
        : /*        : provider === Provider.TWITTER
        ? buildUri(this.twitterService.redirectAuthEndpointUrl)*/
        provider === Provider.GITHUB
        ? this.githubService.redirectAuthEndpointUrl(
            state,
            this.redirectUri(provider),
          )
        : null;

    if (!uri)
      throw new NotFoundException({
        code: 'provider_unavailable',
        message: 'The requested service provider is unavailable.',
      });

    console.log(uri);

    res.redirect(uri);
  }

  public async link(
    session: SessionEntity,
    provider: Provider,
    state: string,
    code: string,
    codeVerifier?: string,
  ) {
    const accountId = await this.kv.get<string>('link:' + state);
    if (BigInt(accountId) !== session.getAccount().id)
      throw new ForbiddenException();

    console.log(provider);

    const user: OAuth2Data | null =
      provider === Provider.GOOGLE
        ? await this.googleService.exchangeAuthorizationCodeAndGetUserData(
            code,
            codeVerifier,
          )
        : provider === Provider.META
        ? await this.facebookService.exchangeAuthorizationCodeAndGetUserData(
            code,
            codeVerifier,
          )
        : provider === Provider.MICROSOFT
        ? await this.microsoftService.exchangeAuthorizationCodeAndGetUserData(
            code,
            codeVerifier,
          )
        : /*        : provider === Provider.TWITTER
        ? this.twitterService.exchangeAuthorizationCodeAndGetUserData(code,c odeVerifier)*/
        provider === Provider.GITHUB
        ? await this.githubService.exchangeAuthorizationCodeAndGetUserData(code)
        : null;
    if (!user)
      throw new NotFoundException({
        code: 'provider_unavailable',
        message: 'The requested service provider is unavailable.',
      });

    const federatedIdentity =
      await this.prismaService.accountFederatedIdentities.findFirst({
        where: {
          accountId: session.getAccount().id,
          provider: provider,
        },
      });
    if (federatedIdentity)
      throw new BadRequestException({
        code: 'federated_identity_already_linked',
        message: `You've already linked a ${capitalize(
          provider,
        )} Sign-In to your account.`,
      });

    await this.prismaService.accountFederatedIdentities
      .create({
        data: {
          accountId: session.getAccount().id,
          email: user.email,
          userId: user.id,
          provider: provider,
        },
      })
      .catch((err: Prisma.PrismaClientKnownRequestError) => {
        if (err.code == 'P2002')
          throw new ConflictException({
            code: 'federated_identity_already_linked',
            message: `${capitalize(
              provider,
            )} Sign-In is associated with another account.`,
          });
        throw new ServiceUnavailableException();
      });
  }

  public async unlink(session: SessionEntity, provider: Provider) {
    const account = await this.prismaService.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id,
      },
      include: {
        federatedIdentities: true,
      },
    });
    const safeAccountData = new AccountEntity(account);

    if (
      safeAccountData.isPasswordLess() &&
      account.federatedIdentities.length <= 1
    )
      throw new BadRequestException({
        code: 'unlink_unavailable',
        message: `Unlinking is not available for your account. Your account is passwordless and has only one federated identity linked.`,
      });

    const federatedIdentity = account.federatedIdentities.find(
      (f) => f.provider === provider,
    );

    if (!federatedIdentity)
      throw new BadRequestException({
        code: 'federated_identity_not_linked',
        message: `The federated identity you're attempting to unlink is not associated with your account.`,
      });

    await this.prismaService.accountFederatedIdentities.delete({
      where: {
        id: federatedIdentity.id,
      },
    });
  }
}
