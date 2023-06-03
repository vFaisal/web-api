import { FastifyReply, FastifyRequest } from "fastify";
import { unixTimestamp } from "../utils/util";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import Tokens from "@fastify/csrf";
import { randomBytes, createHash } from "crypto";

@Injectable()
export default class PKCEService {

  private static readonly COOKIE_EXPIRATION = 60 * 15;

  constructor(private config: ConfigService) {
  }


  public enforcePKCE(res: FastifyReply, req: FastifyRequest) {
    const cookieCodeVerifier = this.getCodeVerifier(req);
    if (cookieCodeVerifier) return this.createCodeChallenge(cookieCodeVerifier);

    const codeVerifier = this.createCodeVerifier();
    res.setCookie("pkce", codeVerifier, {
      expires: unixTimestamp(PKCEService.COOKIE_EXPIRATION, "DATE"),
      httpOnly: true,
      secure: (this.config.getOrThrow("NODE_ENV") === "production"),
      domain: ".faisal.gg",
      path: "/",
      signed: true
    });

    return this.createCodeChallenge(codeVerifier);
  }

  public getCodeVerifier(req: FastifyRequest) {
    const signedCodeVerifier = req.cookies?.["pkce"];
    const unsignedCodeVerifier = signedCodeVerifier ? req.unsignCookie(signedCodeVerifier) : null;
    return unsignedCodeVerifier?.valid && /^[a-z0-9]{64}$/.test(unsignedCodeVerifier.value) ? unsignedCodeVerifier.value : null;
  }

  private createCodeVerifier() {
    return randomBytes(32).toString("hex");
  }

  private createCodeChallenge(codeVerifier: string) {
    return createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
  }
}
