import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import AuthenticateDto from './dto/authenticate.dto';
import { significantRequestInformation } from '../shared/utils/util';
import RefreshTokenDto from './dto/refresh-token.dto';
import { AuthGuard } from './auth.guard';
import SessionEntity from './entities/session.entity';
import { Recaptcha } from '../shared/security/recaptch.decorator';
import { FastifyRequest } from 'fastify';

@Controller({
  version: '1',
})
export class AuthController {
  constructor(private readonly authenticateService: AuthService) {}

  @Post('authenticate')
  @HttpCode(HttpStatus.OK)
  @Recaptcha('login')
  public authenticate(
    @Body() body: AuthenticateDto,
    @Req() req: FastifyRequest,
  ) {
    return this.authenticateService.authenticate(
      body.email,
      body.password,
      significantRequestInformation(req),
    );
  }

  @Put('auth/token')
  @HttpCode(HttpStatus.OK)
  public refreshToken(
    @Body() body: RefreshTokenDto,
    @Req() req: FastifyRequest,
  ) {
    return this.authenticateService.refreshToken(
      body.token,
      significantRequestInformation(req),
    );
  }

  @Delete('auth/token')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public revokeToken(@Req() req) {
    const session: SessionEntity = req.session;
    return this.authenticateService.revokeToken(session);
  }
}
