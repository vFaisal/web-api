import { Body, Controller, Get, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import AuthenticateDto from "./dto/authenticate.dto";
import RecaptchaGuard from "../recaptcha/recaptcha.guard";
import { RecaptchaAction } from "../recaptcha/recaptch.decorator";

@Controller({
  version: "1"
})
export class AuthController {
  constructor(private readonly authenticateService: AuthService) {
  }

  @Get("authenticate")
  @HttpCode(HttpStatus.OK)
  @RecaptchaAction("login")
  @UseGuards(RecaptchaGuard)
  public authenticate(@Body() body: AuthenticateDto) {
    return this.authenticateService.authenticate(body.email, body.password);
  }
}
