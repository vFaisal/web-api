import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { AccessService } from './access.service';
import {
  AccessLevel,
  Authorization,
} from '../../core/security/authorization.decorator';
import { FastifyRequest } from 'fastify';
import SessionEntity from '../../auth/entities/session.entity';
import RequestMediumAccessLevelDto from './dto/request-medium-access-level.dto';

@Controller({
  path: 'account/access',
  version: '1',
})
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get()
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.OK)
  availableRequestAccessLevelMethods(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.accessService.availableRequestAccessLevelMethods(session);
  }

  @Post('password')
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.NO_CONTENT)
  requestMediumAccessLevelByPassword(
    @Req() request: FastifyRequest,
    @Body() body: RequestMediumAccessLevelDto,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accessService.requestMediumAccessLevelByPassword(
      session,
      body.password,
    );
  }
}
