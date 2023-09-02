import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MultiFactorService } from './multi-factor.service';
import { FastifyRequest } from 'fastify';
import SessionEntity from '../../auth/entities/session.entity';
import { AuthGuard } from '../../auth/auth.guard';
import VerifyTotpEntity from './dto/verify-totp.entity';
import {
  AccessLevel,
  Authorization,
} from '../../core/security/authorization.decorator';

@Controller({
  path: 'account/multi-factor',
  version: '1',
})
export class MfaController {
  constructor(private readonly multiFactorService: MultiFactorService) {}

  @Post('totp')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.OK)
  public configureTOTP(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.configureTOTP(session);
  }

  @Patch('totp')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public verifyTOTP(
    @Req() request: FastifyRequest,
    @Body() body: VerifyTotpEntity,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.verifyTOTP(session, body.digit);
  }

  @Delete('totp')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public disableTOTP(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.disableTOTP(session);
  }

  @Post('sms')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public enableSMS(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.enableSMS(session);
  }

  @Delete('sms')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public disableSMS(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.disableSMS(session);
  }

  @Post('whatsapp')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public enableWhatsapp(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.enableWhatsapp(session);
  }

  @Delete('whatsapp')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public disableWhatsapp(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.disableWhatsapp(session);
  }

  @Post('email')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public enableEmail(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.enableEmail(session);
  }

  @Delete('email')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public disableEmail(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.disableEmail(session);
  }
}
