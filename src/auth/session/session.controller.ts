import { Controller, Delete, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { SessionServiceB } from './session.service';
import {
  AccessLevel,
  Authorization,
} from '../../core/security/authorization.decorator';
import { FastifyRequest } from 'fastify';
import SessionEntity from '../entities/session.entity';

@Controller({
  path: 'auth/session',
  version: '1',
})
export class SessionController {
  constructor(private readonly sessionService: SessionServiceB) {}

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authorization(AccessLevel.NONE)
  revokeCurrentSession(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.sessionService.revokeCurrentSession(session);
  }
}
