import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { MultiFactorService } from './multi-factor.service';
import { FastifyRequest } from 'fastify';
import ParseNanoidPipe from '../../shared/pipes/parse-nanoid.pipe';
import { significantRequestInformation } from '../../core/utils/util';
import MultiFactorLoginStartVerificationDto from './dto/multi-factor-login-start-verification.dto';
import MultiFactorLoginVerifyDto from './dto/multi-factor-login-verify.dto';

@Controller({
  path: 'auth/multi-factor',
  version: '1',
})
export class MultiFactorController {
  constructor(private readonly multiFactorService: MultiFactorService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  public startVerification(
    @Req() req: FastifyRequest,
    @Body('token', new ParseNanoidPipe(16)) token: string,
    @Body() body: MultiFactorLoginStartVerificationDto,
  ) {
    return this.multiFactorService.startVerification(token, body);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  public verify(
    @Req() req: FastifyRequest,
    @Body('token', new ParseNanoidPipe(16)) token: string,
    @Body() body: MultiFactorLoginVerifyDto,
  ) {
    return this.multiFactorService.verify(
      token,
      body.code,
      significantRequestInformation(req),
    );
  }
}
