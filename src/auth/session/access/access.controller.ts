import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { AccessService } from './access.service';
import {
  AccessLevel,
  Authorization,
} from '../../../core/security/authorization.decorator';
import { FastifyRequest } from 'fastify';
import SessionEntity from '../../entities/session.entity';
import RequestMediumAccessLevelDto from './dto/request-medium-access-level.dto';
import { significantRequestInformation } from '../../../core/utils/util';
import ParseNanoidPipe from '../../../shared/pipes/parse-nanoid.pipe';
import VerifyRequestMediumAccessLevelByEmailDto from './dto/verify-request-medium-access-level-by-email.dto';
import RequestMediumAccessLevelByPhoneDto from './dto/request-medium-access-level-by-phone.dto';
import VerifyRequestMediumAccessLevelByPhoneDto from './dto/verify-request-medium-access-level-by-phone.dto';
import RequestMediumAccessLevelByTotpDto from './dto/request-medium-access-level-by-totp.dto';

@Controller({
  path: 'auth/session/access',
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

  @Post('email')
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.OK)
  requestMediumAccessLevelByEmail(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.accessService.requestMediumAccessLevelByEmail(
      session,
      significantRequestInformation(request),
    );
  }

  @Post('email/verify')
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.OK)
  verifyRequestMediumAccessByEmail(
    @Req() request: FastifyRequest,
    @Body('token', new ParseNanoidPipe(16)) token: string,
    @Body() body: VerifyRequestMediumAccessLevelByEmailDto,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accessService.verifyRequestMediumAccessByEmail(
      session,
      body.code,
      token,
    );
  }

  @Post('email/resend')
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.OK)
  resendRequestMediumAccessLevelByEmail(
    @Req() request: FastifyRequest,
    @Body('token', new ParseNanoidPipe(16)) token: string,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accessService.resendRequestMediumAccessLevelByEmail(
      session,
      significantRequestInformation(request),
      token,
    );
  }

  @Post('phone')
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.OK)
  requestMediumAccessLevelByPhone(
    @Req() request: FastifyRequest,
    @Body() body: RequestMediumAccessLevelByPhoneDto,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accessService.requestMediumAccessLevelByPhone(
      session,
      body.channel,
    );
  }

  @Post('phone/verify')
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.OK)
  verifyRequestMediumAccessByPhone(
    @Req() request: FastifyRequest,
    @Body('token', new ParseNanoidPipe(16)) token: string,
    @Body() body: VerifyRequestMediumAccessLevelByPhoneDto,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accessService.verifyRequestMediumAccessLevelByPhone(
      session,
      body.code,
      token,
    );
  }

  @Post('phone/resend')
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.OK)
  resendRequestMediumAccessLevelByPhone(
    @Req() request: FastifyRequest,
    @Body() body: RequestMediumAccessLevelByPhoneDto,
    @Body('token', new ParseNanoidPipe(16)) token: string,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accessService.resendRequestMediumAccessLevelByPhone(
      session,
      token,
      body.channel,
    );
  }

  @Post('totp')
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.OK)
  requestMediumAccessLevelByTOTP(
    @Req() request: FastifyRequest,
    @Body() body: RequestMediumAccessLevelByTotpDto,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accessService.verifyRequestMediumAccessLevelByTOTP(
      session,
      body.code,
    );
  }
}
