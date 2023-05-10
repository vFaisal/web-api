import { Controller, Get, HttpCode, HttpStatus, Param, Query, Res } from "@nestjs/common";
import { GoogleService } from "./google.service";
import FederatedIdentityQuery from "../dto/federated-identity-query";

@Controller({
  path: "/auth/federated-identities/google",
  version: "1"
})
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  root(@Res() res) {
    res.status(HttpStatus.TEMPORARY_REDIRECT).redirect(this.googleService.redirectAuthEndpointUrl());
  }

  @Get("callback")
  @HttpCode(HttpStatus.OK)
  callback(@Query() query: FederatedIdentityQuery) {
    return this.googleService.exchangeAuthorizationCode(query.code);
  }
}
