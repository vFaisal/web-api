import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { FederatedIdentitiesService } from "./federated-identities.service";
import RegistrationDto from "../../registration/dto/registration.dto";
import { FastifyRequest } from "fastify";

@Controller("federated-identities")
export class FederatedIdentitiesController {
  constructor(private readonly federatedIdentitiesService: FederatedIdentitiesService) {
  }

  @Post("registration")
  @HttpCode(HttpStatus.CREATED)
  registration(@Body() body: RegistrationDto, @Req() req: FastifyRequest) {

  }
}
