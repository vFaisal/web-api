import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FederatedIdentitiesService } from '../federated-identities.service';
import { SignificantRequestInformation } from '../../../shared/utils/util';
import { Provider } from '@prisma/client';

@Injectable()
export class GithubService {
  private static readonly AUTH_ENDPOINT = `https://github.com/login/oauth/authorize`;
  private static readonly APPLICATION_SCOPES = [];
  private static readonly REDIRECT_URI =
    'https://api.faisal.gg/v1/auth/federated-identities/github/callback';

  private readonly logger: Logger = new Logger('GithubService');

  constructor(
    private config: ConfigService,
    private federatedIdentitiesService: FederatedIdentitiesService,
  ) {}

  public async authenticate(
    code: string,
    significantRequestInformation: SignificantRequestInformation,
  ) {
    const auth = await this.exchangeAuthorizationCode(code);

    const user = await this.getUser(auth.access_token);
    const userEmails: any[] = await this.getUserEmails(auth.access_token);

    const userPrimaryEmail = userEmails.find((e) => e.primary);
    if (!userPrimaryEmail?.verified)
      throw new BadRequestException({
        code: 'github_unverified_email',
        message:
          "The user's Github account email address is not verified and cannot be used for authentication.",
      });

    return this.federatedIdentitiesService.authenticate(
      userPrimaryEmail.email,
      String(user.id),
      Provider.MICROSOFT,
      user.avatar_url,
      user.name,
      significantRequestInformation,
    );
  }

  public async exchangeAuthorizationCode(code: string) {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.getOrThrow('GITHUB_CLIENT_ID'),
        client_secret: this.config.getOrThrow('GITHUB_CLIENT_SECRET'),
        code: code,
        redirect_uri: GithubService.REDIRECT_URI,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      if (data?.error === 'bad_verification_code')
        throw new BadRequestException({
          code: 'github_invalid_grant',
          message: 'The authorization code is invalid or has expired.',
        });
      this.logger.error(
        "unexpected response from oauth2 Github api 'github.com/login/oauth/access_token'",
        data,
      );
      throw new ServiceUnavailableException();
    }

    const scopes: string[] = data.scope.split(',').filter((s) => s);

    if (
      !GithubService.APPLICATION_SCOPES.every((s) => scopes.includes(s)) ||
      !scopes.every((s) => GithubService.APPLICATION_SCOPES.includes(s))
    )
      throw new BadRequestException({
        code: 'github_invalid_scopes',
        message:
          'The requested scope is not valid or does not match the scopes configured for our application.',
      });

    return data;
  }

  private async getUser(accessToken: string) {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        authorization: 'Bearer ' + accessToken,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      this.logger.error(
        "unexpected response from github api 'api.github.com/user'",
        data,
      );
      throw new ServiceUnavailableException();
    }

    return data;
  }

  private async getUserEmails(accessToken: string) {
    const res = await fetch('https://api.github.com/user/emails', {
      headers: {
        authorization: 'Bearer ' + accessToken,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      this.logger.error(
        "unexpected response from github api 'api.github.com/user/emails'",
        data,
      );
      throw new ServiceUnavailableException();
    }

    return data;
  }

  public redirectAuthEndpointUrl(state: string) {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow('GITHUB_CLIENT_ID'),
      // response_type: "code",
      state: state,
      scope: GithubService.APPLICATION_SCOPES.join(' '),
      redirect_uri: GithubService.REDIRECT_URI,
    });
    return GithubService.AUTH_ENDPOINT + '?' + params.toString();
  }
}
