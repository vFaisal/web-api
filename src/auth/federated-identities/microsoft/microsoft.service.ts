import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { FederatedIdentitiesService } from "../federated-identities.service";
import { SignificantRequestInformation } from "../../../utils/util";
import { Provider } from "@prisma/client";

@Injectable()
export class MicrosoftService {

  private static readonly TENANT = "consumers";
  private static readonly AUTH_ENDPOINT = `https://login.microsoftonline.com/${MicrosoftService.TENANT}/oauth2/v2.0/authorize`;
  private static readonly APPLICATION_SCOPES = ["email", "openid", "profile"];
  private static readonly REDIRECT_URI = "https://api.faisal.gg/v1/auth/federated-identities/microsoft/callback";
  private static readonly API_BASE = "https://graph.microsoft.com/v1.0";

  private readonly logger: Logger = new Logger("MicrosoftService");

  constructor(private config: ConfigService, private federatedIdentitiesService: FederatedIdentitiesService) {
  }

  public async authenticate(code: string, codeVerifier: string, significantRequestInformation: SignificantRequestInformation) {

    //exchange code here//
    const auth = await this.exchangeAuthorizationCode(code, codeVerifier);

    const userInfo = this.federatedIdentitiesService.getUserInfoByDecodingIdToken(auth.id_token);
    const photo = await this.getProfilePhoto(auth.access_token);

    return this.federatedIdentitiesService.authenticate(userInfo.email, userInfo.sub, Provider.MICROSOFT, photo, userInfo.name, significantRequestInformation);
  }


  public async exchangeAuthorizationCode(code: string, codeVerifier: string) {
    const res = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        tenant: MicrosoftService.TENANT,
        client_id: this.config.getOrThrow("MICROSOFT_CLIENT_ID"),
        client_secret: this.config.getOrThrow("MICROSOFT_CLIENT_SECRET"),
        code: code,
        scope: MicrosoftService.APPLICATION_SCOPES.join(" "),
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
        redirect_uri: MicrosoftService.REDIRECT_URI
      })
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.error === "invalid_grant") throw  new BadRequestException({
        code: "microsoft_invalid_grant",
        message: "The authorization code is invalid or has expired."
      });
      this.logger.error("unexpected response from oauth2 Microsoft api 'login.microsoftonline.com/consumers/oauth2/v2.0/token'", data);
      throw new ServiceUnavailableException();
    }

    const scopes: string[] = data.scope.split(" ");

    if (!MicrosoftService.APPLICATION_SCOPES.every(s => scopes.includes(s)) || !scopes.every(s => MicrosoftService.APPLICATION_SCOPES.includes(s))) throw new BadRequestException({
      code: "microsoft_invalid_scopes",
      message: "The requested scope is not valid or does not match the scopes configured for our application."
    });

    return data;

  }

  private async getProfilePhoto(accessToken: string): Promise<string | null> {
    const res = await fetch(MicrosoftService.API_BASE + "/me/photos/504x504/$value", {
      headers: {
        authorization: "Bearer " + accessToken
      }
    });
    if (res.ok) {
      const photoBuffer = await res.arrayBuffer().catch(() => null);
      if (photoBuffer)
        return `data:image/jpeg;base64, ${Buffer.from(photoBuffer).toString("base64")}`;
    }
    return null;
  }

  public redirectAuthEndpointUrl(state: string, codeChallenge: string, selectAccount = false) {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow("MICROSOFT_CLIENT_ID"),
      response_type: "code",
      state: state,
      scope: MicrosoftService.APPLICATION_SCOPES.join(" "),
      //prompt: selectAccount ? "select_account" : "consent",
      redirect_uri: MicrosoftService.REDIRECT_URI,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });
    if (selectAccount) params.set("prompt", "select_account");
    return MicrosoftService.AUTH_ENDPOINT + "?" + params.toString();
  }
}
