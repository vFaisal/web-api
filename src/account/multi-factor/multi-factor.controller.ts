import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { MultiFactorService } from './multi-factor.service';
import { FastifyRequest } from 'fastify';
import SessionEntity from '../../auth/entities/session.entity';
import VerifyTotpEntity from './dto/verify-totp.entity';
import {
  AccessLevel,
  Authorization,
} from '../../core/security/authorization.decorator';
import { significantRequestInformation } from '../../core/utils/util';

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
    return this.multiFactorService.verifyTOTP(
      session,
      significantRequestInformation(request),
      body.digit,
    );
  }

  @Delete('totp')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public disableTOTP(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.disableTOTP(
      session,
      significantRequestInformation(request),
    );
  }

  @Post('sms')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public enableSMS(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.enableSMS(
      session,
      significantRequestInformation(request),
    );
  }

  @Delete('sms')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public disableSMS(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.disableSMS(
      session,
      significantRequestInformation(request),
    );
  }

  @Post('whatsapp')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public enableWhatsapp(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.enableWhatsapp(
      session,
      significantRequestInformation(request),
    );
  }

  @Delete('whatsapp')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public disableWhatsapp(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.disableWhatsapp(
      session,
      significantRequestInformation(request),
    );
  }

  @Post('email')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public enableEmail(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.enableEmail(
      session,
      significantRequestInformation(request),
    );
  }

  @Delete('email')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  public disableEmail(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.disableEmail(
      session,
      significantRequestInformation(request),
    );
  }
}
