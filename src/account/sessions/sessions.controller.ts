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
import ParseNanoidPipe from '../../pipes/parse-nanoid.pipe';

@Controller({
  path: 'account/sessions',
  version: '1',
})
export class SessionsController {
  constructor(private readonly sessionService: SessionsService) {}

  @Get()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  getSessions(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.sessionService.getAll(session);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSession(
    @Req() request: FastifyRequest,
    @Param('id', new ParseNanoidPipe(16)) sessionId: string,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.sessionService.delete(session, sessionId);
  }

  @Delete()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSessions(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.sessionService.deleteAll(session);
  }
}
