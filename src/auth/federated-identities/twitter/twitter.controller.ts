import { Controller, Get, HttpCode, HttpStatus, Query, Req, Res } from "@nestjs/common";
import { TwitterService } from "./twitter.service";
import { CsrfProtection } from "../../../security/csrf-protection.decorator";
import FederatedIdentityQueryDto from "../dto/federated-identity-query.dto";
import { significantRequestInformation } from "../../../utils/util";
import CSRFService from "../../../security/csrf.service";
import { PkceVerifierCode } from "../../../security/pkce.decorator";
import PKCEService from "../../../security/pkce.service";

@Controller({
  path: "/auth/federated-identities/twitter",
  version: "1"
})
export class TwitterController {
  constructor(private readonly twitterService: TwitterService, private readonly csrfService: CSRFService, private readonly pkceService: PKCEService) {
  }

  @Get("")
  @HttpCode(HttpStatus.SEE_OTHER)
  async root(@Res() res, @Req() req) {
    const token = await this.csrfService.create(req, res, "auth");
    res.redirect(this.twitterService.redirectAuthEndpointUrl(token, this.pkceService.enforcePKCE(res)));
  }

  @Get("callback")
  @HttpCode(HttpStatus.OK)
  @CsrfProtection("auth")
  callback(@Query() query: FederatedIdentityQueryDto, @PkceVerifierCode() verifierCode: string, @Req() req) {
    return this.twitterService.authenticate(query.code, verifierCode, significantRequestInformation(req));
  }
}
