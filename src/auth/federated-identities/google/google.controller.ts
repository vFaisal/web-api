import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  Res
} from "@nestjs/common";
import { GoogleService } from "./google.service";
import FederatedIdentityQueryDto from "../dto/federated-identity-query.dto";
import CSRFService from "../../../security/csrf.service";
import { significantRequestInformation } from "../../../utils/util";
import { CsrfProtection } from "../../../security/csrf-protection.decorator";

@Controller({
  path: "/auth/federated-identities/google",
  version: "1"
})
export class GoogleController {
  constructor(private readonly googleService: GoogleService, private readonly csrfService: CSRFService) {
  }

  @Get("")
  @HttpCode(HttpStatus.SEE_OTHER)
  async root(@Res() res, @Req() req) {
    const token = await this.csrfService.create(req, res, "auth");
    res.redirect(this.googleService.redirectAuthEndpointUrl(token));
  }

  @Get("callback")
  @HttpCode(HttpStatus.OK)
  @CsrfProtection("auth")
  callback(@Query() query: FederatedIdentityQueryDto, @Req() req) {
    return this.googleService.authenticate(query.code, significantRequestInformation(req));
  }
}
