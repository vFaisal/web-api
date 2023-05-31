import { Controller, Get, HttpCode, HttpStatus, Query, Req, Res } from "@nestjs/common";
import { MicrosoftService } from "./microsoft.service";
import { CsrfProtection } from "../../../security/csrf-protection.decorator";
import FederatedIdentityQueryDto from "../dto/federated-identity-query.dto";
import { significantRequestInformation } from "../../../utils/util";
import CSRFService from "../../../security/csrf.service";

@Controller({
  path: "/auth/federated-identities/microsoft",
  version: "1"
})
export class MicrosoftController {
  constructor(private readonly microsoftService: MicrosoftService, private readonly csrfService: CSRFService) {
  }

  @Get("")
  @HttpCode(HttpStatus.SEE_OTHER)
  async root(@Res() res, @Req() req) {
    const token = await this.csrfService.create(req, res, "auth");
    res.redirect(this.microsoftService.redirectAuthEndpointUrl(token));
  }

  @Get("callback")
  @HttpCode(HttpStatus.OK)
  @CsrfProtection("auth")
  callback(@Query() query: FederatedIdentityQueryDto, @Req() req) {
    return this.microsoftService.authenticate(query.code, significantRequestInformation(req));
  }
}
