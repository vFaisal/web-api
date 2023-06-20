import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { TwoFactorService } from "./two-factor.service";
import { FastifyRequest } from "fastify";
import SessionEntity from "../../auth/entities/session.entity";
import { AuthGuard } from "../../auth/auth.guard";
import VerifyTotpEntity from "./dto/verify-totp.entity";

@Controller({
  path: "account/two-factor",
  version: "1"
})
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {
  }

  @Post("totp")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  public configureTOTP(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.twoFactorService.configureTOTP(session);
  }

  @Patch("totp")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  public verifyTOTP(@Req() request: FastifyRequest, @Body() body: VerifyTotpEntity) {
    const session: SessionEntity = (request as any).session;
    return this.twoFactorService.verifyTOTP(session, body.digit);
  }
}
