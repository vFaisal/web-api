import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FederatedIdentitiesService } from '../federated-identities.service';
import {
  SignificantRequestInformation,
  unixTimestamp,
} from '../../../core/utils/util';
import { Provider } from '@prisma/client';
import { createHmac } from 'crypto';

@Injectable()
export class FacebookService {
  private static readonly AUTH_ENDPOINT =
    'https://www.facebook.com/v17.0/dialog/oauth';
  private static readonly APPLICATION_SCOPES = [
    'openid',
    'public_profile',
    'email',
  ];
  private static readonly REDIRECT_URI =
    'https://api.faisal.gg/v1/auth/federated-identities/facebook/callback';
  private static readonly API_BASE = 'https://graph.facebook.com/v17.0';

  private readonly logger: Logger = new Logger('FacebookService');

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

    //Fetch large profile picture
    const picture =
      (await this.getProfilePicture(auth.access_token)) ?? userInfo.picture;

    return this.federatedIdentitiesService.authenticate(
      userInfo.email,
      userInfo.sub,
      Provider.META,
      picture,
      userInfo.name,
      significantRequestInformation,
    );
  }

  public async exchangeAuthorizationCode(code: string, codeVerifier: string) {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow('FACEBOOK_CLIENT_ID'),
      //client_secret: this.config.getOrThrow("FACEBOOK_CLIENT_SECRET"), // Client secret optional if code verifier included. (I don't feel it's secure that it be optional. Are they sure the safety of this mechanism? idk)
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: FacebookService.REDIRECT_URI,
      code_verifier: codeVerifier,
    });

    const res = await fetch(
      FacebookService.API_BASE + '/oauth/access_token?' + params.toString(),
    );

    const data = await res.json();
    if (!res.ok) {
      if (data.error.code == 100)
        throw new BadRequestException({
          code: 'facebook_invalid_grant',
          message: 'The authorization code is invalid or has expired.',
        });
      this.logger.error(
        "unexpected response from oauth2 Facebook api 'graph.facebook.com/v17.0/oauth/access_token'",
        data,
      );
      throw new ServiceUnavailableException();
    }

    return data;
  }

  private async getProfilePicture(accessToken) {
    const timestamp = unixTimestamp();
    const params = new URLSearchParams({
      fields: 'id,name,picture.width(480).height(480)',
      access_token: accessToken,
      appsecret_proof: createHmac(
        'sha256',
        this.config.getOrThrow('FACEBOOK_CLIENT_SECRET'),
      )
        .update(accessToken + '|' + timestamp)
        .digest('hex'),
      appsecret_time: String(timestamp),
    });
    const url = FacebookService.API_BASE + '/me?' + params.toString();

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      this.logger.debug(`unexpected response from Facebook api '${url}'`, data);
      return null;
    }
    return data?.picture?.data?.url ?? null;
  }

  public redirectAuthEndpointUrl(
    state: string,
    codeChallenge: string,
    selectAccount = false,
  ) {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow('FACEBOOK_CLIENT_ID'),
      response_type: 'code',
      state: state,
      scope: FacebookService.APPLICATION_SCOPES.join(' '),
      redirect_uri: FacebookService.REDIRECT_URI,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return FacebookService.AUTH_ENDPOINT + '?' + params.toString();
  }
}
