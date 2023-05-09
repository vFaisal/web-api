import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { RegistrationService } from "./registration.service";
import RegistrationDto from "./dto/registration.dto";
import RecaptchaGuard from "../recaptcha/recaptcha.guard";
import { RecaptchaAction } from "../recaptcha/recaptch.decorator";
import { significantRequestInformation } from "../utils/util";
import { Request } from "express";

@Controller({
  path: "registration",
  version: "1"
})
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {
  }


  @Post()
  @HttpCode(HttpStatus.CREATED)
  root(@Body() body: RegistrationDto, @Req() req: Request) {
    return this.registrationService.createAccount(body, significantRequestInformation(req));
  }
}
