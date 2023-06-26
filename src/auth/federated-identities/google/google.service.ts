import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../auth.service';
import { FederatedIdentitiesService } from '../federated-identities.service';
import { Provider } from '@prisma/client';
import {
  SignificantRequestInformation,
  significantRequestInformation,
} from '../../../core/utils/util';

@Injectable()
export class GoogleService {
  private static readonly AUTH_ENDPOINT =
    'https://accounts.google.com/o/oauth2/v2/auth';
  private static readonly APPLICATION_SCOPES = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ];
  private static readonly REDIRECT_URI =
    'https://api.faisal.gg/v1/auth/federated-identities/google/callback';

  private readonly logger: Logger = new Logger('GoogleService');

  constructor(
    private config: ConfigService,
    private federatedIdentitiesService: FederatedIdentitiesService,
  ) {}

  public async authenticate(
    code: string,
    codeVerifier: string,
    significantRequestInformation: SignificantRequestInformation,
  ) {
    //exchange code here//
    const auth = await this.exchangeAuthorizationCode(code, codeVerifier);

    const userInfo =
      this.federatedIdentitiesService.getUserInfoByDecodingIdToken(
        auth.id_token,
      );

    if (!userInfo?.email_verified)
      throw new BadRequestException({
        code: 'google_unverified_email',
        message:
          "The user's Google account email address is not verified and cannot be used for authentication.",
      });

    return this.federatedIdentitiesService.authenticate(
      userInfo.email,
      userInfo.sub,
      Provider.GOOGLE,
      userInfo.picture,
      userInfo.name,
      significantRequestInformation,
    );
  }

  public async exchangeAuthorizationCode(code: string, codeVerifier: string) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.getOrThrow('GOOGLE_CLIENT_ID'),
        client_secret: this.config.getOrThrow('GOOGLE_CLIENT_SECRET'),
        code: code,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
        redirect_uri: GoogleService.REDIRECT_URI,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.error === 'invalid_grant')
        throw new BadRequestException({
          code: 'google_invalid_grant',
          message: 'The authorization code is invalid or has expired.',
        });
      this.logger.error(
        "unexpected response from oauth2 Google api 'oauth2.googleapis.com/token'",
        data,
      );
      throw new ServiceUnavailableException();
    }

    const scopes: string[] = data.scope.split(' ');

    if (
      !GoogleService.APPLICATION_SCOPES.every((s) => scopes.includes(s)) ||
      !scopes.every((s) => GoogleService.APPLICATION_SCOPES.includes(s))
    )
      throw new BadRequestException({
        code: 'google_invalid_scopes',
        message:
          'The requested scope is not valid or does not match the scopes configured for our application.',
      });

    return data;
  }

  public redirectAuthEndpointUrl(
    state: string,
    codeChallenge: string,
    selectAccount = false,
  ) {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow('GOOGLE_CLIENT_ID'),
      response_type: 'code',
      state: state,
      scope: GoogleService.APPLICATION_SCOPES.join(' '),
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: selectAccount ? 'select_account' : 'none',
      redirect_uri: GoogleService.REDIRECT_URI,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return GoogleService.AUTH_ENDPOINT + '?' + params.toString();
  }
}
