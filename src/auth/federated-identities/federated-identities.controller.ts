import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { FederatedIdentitiesService } from './federated-identities.service';
import { FastifyRequest } from 'fastify';
import FederatedRegistrationDto from './dto/federated-registration.dto';
import { significantRequestInformation } from '../../shared/utils/util';

@Controller({
  path: '/auth/federated-identities',
  version: '1',
})
export class FederatedIdentitiesController {
  constructor(
    private readonly federatedIdentitiesService: FederatedIdentitiesService,
  ) {}

  @Post('registration')
  @HttpCode(HttpStatus.CREATED)
  registration(
    @Body() body: FederatedRegistrationDto,
    @Req() req: FastifyRequest,
  ) {
    return this.federatedIdentitiesService.registration(
      body.signature,
      body.email,
      significantRequestInformation(req),
    );
  }
}
