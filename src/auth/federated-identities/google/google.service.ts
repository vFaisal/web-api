import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../../auth.service";
import { FederatedIdentitiesService } from "../federated-identities.service";
import { Provider } from "@prisma/client";
import { SignificantRequestInformation, significantRequestInformation } from "../../../utils/util";

@Injectable()
export class GoogleService {
  private static readonly AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
  private static readonly APPLICATION_SCOPES = ["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email", "openid"];
  private static readonly REDIRECT_URI = "https://api.faisal.gg/v1/auth/federated-identities/google/callback";


  private readonly logger: Logger = new Logger("GoogleService");

  constructor(private config: ConfigService, private jwt: JwtService, private federatedIdentitiesService: FederatedIdentitiesService) {
  }


  public async authenticate(code: string, significantRequestInformation: SignificantRequestInformation) {

    //exchange code here//
    const auth = await this.exchangeAuthorizationCode(code);

    return this.federatedIdentitiesService.authenticate(auth.userInfo.email, auth.userInfo.sub, Provider.GOOGLE, auth.userInfo.picture, significantRequestInformation);
  }

  public getUserInfoByDecoding(token: string): any {
    return this.jwt.decode(token);
  }

  public async exchangeAuthorizationCode(code: string) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: this.config.get("GOOGLE_CLIENT_ID"),
        client_secret: this.config.get("GOOGLE_CLIENT_SECRET"),
        code: code,
        grant_type: "authorization_code",
        redirect_uri: GoogleService.REDIRECT_URI
      })
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.error === "invalid_grant") throw  new BadRequestException({
        code: "google_invalid_grant",
        message: "The authorization code is invalid or has expired."
      });
      this.logger.error("unexpected response from oauth2 google api 'oauth2.googleapis.com/token'", data);
      throw new ServiceUnavailableException();
    }

    const scopes: string[] = data.scope.split(" ");

    if (!GoogleService.APPLICATION_SCOPES.every(s => scopes.includes(s)) || !scopes.every(s => GoogleService.APPLICATION_SCOPES.includes(s))) throw new BadRequestException({
      code: "google_invalid_scopes",
      message: "The requested scope is not valid or does not match the scopes configured for our application."
    });

    const userInfo = this.getUserInfoByDecoding(data.id_token);

    if (!userInfo?.email_verified) throw new BadRequestException({
      code: "google_unverified_email",
      message: "The user's Google account email address is not verified and cannot be used for authentication."
    });

    return {
      ...data,
      userInfo
    };

  }

  public redirectAuthEndpointUrl(state: string) {
    const params = new URLSearchParams({
      client_id: this.config.get("GOOGLE_CLIENT_ID"),
      response_type: "code",
      state: state,
      scope: GoogleService.APPLICATION_SCOPES.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      redirect_uri: GoogleService.REDIRECT_URI
    });
    return GoogleService.AUTH_ENDPOINT + "?" + params.toString();
  }
}
