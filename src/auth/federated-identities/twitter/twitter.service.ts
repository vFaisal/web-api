import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FederatedIdentitiesService } from "../federated-identities.service";
import { SignificantRequestInformation } from "../../../utils/util";

@Injectable()
export class TwitterService {
  private static readonly AUTH_ENDPOINT = "https://twitter.com/i/oauth2/authorize";
  private static readonly APPLICATION_SCOPES = ["users.read", "tweet.read", "offline.access"];
  private static readonly REDIRECT_URI = "https://api.faisal.gg/v1/auth/federated-identities/twitter/callback";
  private static readonly API_BASE = "https://api.twitter.com/2";

  private readonly logger: Logger = new Logger("TwitterService");

  constructor(private config: ConfigService, private federatedIdentitiesService: FederatedIdentitiesService) {
  }

  public async authenticate(code: string, codeVerifier: string, significantRequestInformation: SignificantRequestInformation) {

    //exchange code here//
    const auth = await this.exchangeAuthorizationCode(code, codeVerifier);

    /*    const photo = await this.getUser(auth.access_token);

        return this.federatedIdentitiesService.authenticate(userInfo.email, userInfo.sub, Provider.MICROSOFT, photo, userInfo.name, significantRequestInformation);*/
  }

  public async exchangeAuthorizationCode(code: string, codeVerifier: string) {

    console.log("PKCE", codeVerifier);

    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: "Basic " + Buffer.from(`${this.config.getOrThrow("TWITTER_CLIENT_ID")}:${this.config.getOrThrow("TWITTER_CLIENT_SECRET")}`).toString("base64")
      },
      body: new URLSearchParams({
        client_id: this.config.getOrThrow("TWITTER_CLIENT_ID"),
        // client_secret: this.config.getOrThrow("TWITTER_CLIENT_SECRET"),
        code: code,
        grant_type: "authorization_code",
        redirect_uri: TwitterService.REDIRECT_URI,
        code_verifier: codeVerifier
      })
    });

    console.log(res.status);
    const data = await res.json();
    console.log(data);
    if (!res.ok) {
      if (data.error === "invalid_request") throw  new BadRequestException({
        code: "twitter_invalid_grant",
        message: "The authorization code is invalid or has expired."
      });
      this.logger.error("unexpected response from oauth2 Twitter api 'api.twitter.com/2/oauth2/token'", data);
      throw new ServiceUnavailableException();
    }

    const scopes: string[] = data.scope.split(" ");

    if (!TwitterService.APPLICATION_SCOPES.every(s => scopes.includes(s)) || !scopes.every(s => TwitterService.APPLICATION_SCOPES.includes(s))) throw new BadRequestException({
      code: "microsoft_invalid_scopes",
      message: "The requested scope is not valid or does not match the scopes configured for our application."
    });

    return data;

  }

  public redirectAuthEndpointUrl(state: string, codeChallenge: string, selectAccount = false) {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow("TWITTER_CLIENT_ID"),
      response_type: "code",
      state: state,
      scope: TwitterService.APPLICATION_SCOPES.join(" "),
      redirect_uri: TwitterService.REDIRECT_URI,
      code_challenge: codeChallenge,
      code_challenge_method: "s256"
    });
    return TwitterService.AUTH_ENDPOINT + "?" + params.toString();
  }
}
