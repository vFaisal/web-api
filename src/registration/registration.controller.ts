import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { RegistrationService } from "./registration.service";
import RegistrationDto from "./dto/registration.dto";
import { significantRequestInformation } from "../utils/util";
import { FastifyRequest } from "fastify";

@Controller({
  path: "registration",
  version: "1"
})
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {
  }


  @Post()
  @HttpCode(HttpStatus.CREATED)
  root(@Body() body: RegistrationDto, @Req() req: FastifyRequest) {
    return this.registrationService.createAccountWithEmail(body, significantRequestInformation(req));
  }
}
