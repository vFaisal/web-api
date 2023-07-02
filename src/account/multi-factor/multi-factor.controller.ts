import {
  Body,
  Controller,
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

@Controller({
  path: 'account/multi-factor',
  version: '1',
})
export class MfaController {
  constructor(private readonly multiFactorService: MultiFactorService) {}

  @Post('totp')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  public configureTOTP(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.configureTOTP(session);
  }

  @Patch('totp')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  public verifyTOTP(
    @Req() request: FastifyRequest,
    @Body() body: VerifyTotpEntity,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.verifyTOTP(session, body.digit);
  }

  @Post('phone')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  public configurePhone(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.multiFactorService.configureTOTP(session);
  }
}
