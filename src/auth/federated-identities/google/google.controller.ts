import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { GoogleService } from "./google.service";
import FederatedIdentityQuery from "../dto/federated-identity-query";
import CSRFGuard from "../../../security/csrf.guard";
import { CSRFSuffix } from "../../../security/csrf-suffix.decorator";
import CSRFService from "../../../security/csrf.service";
import { significantRequestInformation } from "../../../utils/util";

@Controller({
  path: "/auth/federated-identities/google",
  version: "1"
})
export class GoogleController {
  constructor(private readonly googleService: GoogleService, private readonly csrfService: CSRFService) {
  }

  /*
  https://api.faisal.gg/v1/auth/federated-identities/google/callback?state=1q7qvf5ccqyjpb8ehdidri6qjl9762vgt1uh7luywjke3ogzewldyv1qh8ahic77dx3w4vyl3b05lhdr33ekqekvceewxyrdl6zh6rc60qvivh4smogwhrvygqeyc7td&code=4%2F0AbUR2VM02aG4jqpXDLvFu7yFZMoxO0uUvstCXtaAdVkZAsfHOT_fZ2TWMsI8sHPo8vw-sQ&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&authuser=0&hd=faisal.gg&prompt=none
   */
  @Get("")
  @HttpCode(HttpStatus.SEE_OTHER)
  async root(@Res() res, @Req() req) {
    const token = await this.csrfService.create(req, res, "auth");
    res.redirect(this.googleService.redirectAuthEndpointUrl(token));
  }

  @Get("callback")
  @HttpCode(HttpStatus.OK)
  @CSRFSuffix("auth")
  @UseGuards(CSRFGuard)
  callback(@Query() query: FederatedIdentityQuery, @Req() req) {
    return this.googleService.authenticate(query.code, significantRequestInformation(req));
  }
}
