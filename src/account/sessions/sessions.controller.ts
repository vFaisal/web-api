import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { AuthGuard } from '../../auth/auth.guard';
import { FastifyRequest } from 'fastify';
import SessionEntity from '../../auth/entities/session.entity';
import ParseNanoidPipe from '../../shared/pipes/parse-nanoid.pipe';
import {
  AccessLevel,
  Authorization,
} from '../../core/security/authorization.decorator';
import { significantRequestInformation } from "../../core/utils/util";

@Controller({
  path: 'account/sessions',
  version: '1',
})
export class SessionsController {
  constructor(private readonly sessionService: SessionsService) {}

  @Get()
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.OK)
  getSessions(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.sessionService.getAll(session);
  }

  @Delete(':id')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSession(
    @Req() request: FastifyRequest,
    @Param('id', new ParseNanoidPipe(16)) sessionId: string,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.sessionService.delete(session, significantRequestInformation(request), sessionId);
  }

  @Delete()
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSessions(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.sessionService.deleteAll(session, significantRequestInformation(request));
  }
}
