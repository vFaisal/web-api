import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import AuthenticateDto from './dto/authenticate.dto';
import { significantRequestInformation } from '../core/utils/util';
import RefreshTokenDto from './dto/refresh-token.dto';
import { AuthGuard } from './auth.guard';
import SessionEntity from './entities/session.entity';
import { Recaptcha } from '../core/security/recaptch.decorator';
import { FastifyRequest } from 'fastify';
import ParseNanoidPipe from '../shared/pipes/parse-nanoid.pipe';
import PasswordRecoveryDto from './dto/password-recovery.dto';
import StartPasswordRecoveryDto from './dto/start-password-recovery.dto';

@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authenticateService: AuthService) {}

  @Post()
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

  @Post('forgot-password')
  @HttpCode(HttpStatus.CREATED)
  @Recaptcha('forgot-password')
  public startPasswordRecovery(
    @Req() req: FastifyRequest,
    @Body() body: StartPasswordRecoveryDto,
  ) {
    return this.authenticateService.startPasswordRecovery(
      body.email,
      significantRequestInformation(req),
    );
  }

  @Get('forgot-password/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  public checkPasswordRecoveryToken(
    @Param('token', new ParseNanoidPipe(64)) token: string,
    @Body() body: PasswordRecoveryDto,
    @Req() req: FastifyRequest,
  ) {
    return this.authenticateService.checkPasswordRecoveryToken(token);
  }

  @Patch('forgot-password/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  public passwordRecovery(
    @Param('token', new ParseNanoidPipe(64)) token: string,
    @Body() body: PasswordRecoveryDto,
    @Req() req: FastifyRequest,
  ) {
    return this.authenticateService.passwordRecovery(significantRequestInformation(req), token, body.password);
  }

  @Put('token')
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

  @Delete('token')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public selfRevokeToken(@Req() req) {
    const session: SessionEntity = req.session;
    return this.authenticateService.selfRevokeSession(session, significantRequestInformation(req));
  }
}
