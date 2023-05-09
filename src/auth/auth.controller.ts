import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import AuthenticateDto from "./dto/authenticate.dto";
import RecaptchaGuard from "../recaptcha/recaptcha.guard";
import { RecaptchaAction } from "../recaptcha/recaptch.decorator";
import { Request } from "express";
import { significantRequestInformation } from "../utils/util";
import RefreshTokenDto from "./dto/refresh-token.dto";
import { AuthGuard } from "./auth.guard";
import SessionEntity from "./entities/session.entity";

@Controller({
  version: "1"
})
export class AuthController {
  constructor(private readonly authenticateService: AuthService) {
  }

  @Post("authenticate")
  @HttpCode(HttpStatus.OK)
  @RecaptchaAction("login")
  @UseGuards(RecaptchaGuard)
  public authenticate(@Body() body: AuthenticateDto, @Req() req: Request) {
    return this.authenticateService.authenticate(body.email, body.password, significantRequestInformation(req));
  }

  @Put("auth/token")
  @HttpCode(HttpStatus.OK)
  public refreshToken(@Body() body: RefreshTokenDto, @Req() req: Request) {
    return this.authenticateService.refreshToken(body.token, significantRequestInformation(req));
  }

  @Delete("auth/token")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public revokeToken(@Req() req) {
    const session: SessionEntity = req.session;
    return this.authenticateService.revokeToken(session);
  }

}
