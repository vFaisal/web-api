import { AccountService } from './account.service';
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
import SessionEntity from '../auth/entities/session.entity';
import { FastifyRequest } from 'fastify';
import StartPhoneVerificationDto from './dto/start-phone-verification.dto';
import ParseNanoidPipe from '../shared/pipes/parse-nanoid.pipe';
import VerifyPhoneVerificationDto from './dto/verify-phone-verification.dto';
import ResendPhoneVerificationDto from './dto/resend-phone-verification.dto';
import UpdateEmailDto from './dto/update-email.dto';
import { significantRequestInformation } from '../core/utils/util';
import VerifyUpdateEmailDto from './dto/verify-update-email.dto';
import UpdatePasswordDto from './dto/update-password.dto';
import UpdateAccountDto from './dto/update-account.dto';
import {
  AccessLevel,
  Authorization,
} from '../core/security/authorization.decorator';

@Controller({
  path: 'account',
  version: '1',
})
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.OK)
  getAccount(@Req() request) {
    const session: SessionEntity = request.session;
    return this.accountService.getSafeAccountData(session.getAccount().id);
  }

  @Put('photo')
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.CREATED)
  async uploadPhoto(@Req() request: FastifyRequest) {
    const file = await request.file();
    const session: SessionEntity = (request as any).session;
    return this.accountService.uploadPhoto(
      file,
      session,
      significantRequestInformation(request),
    );
  }

  @Delete('photo')
  @Authorization(AccessLevel.NONE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePhoto(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.deletePhoto(
      session,
      significantRequestInformation(request),
    );
  }

  @Delete('phone')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePhone(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.deletePhone(
      session,
      significantRequestInformation(request),
    );
  }

  @Post('update-phone/start-verification')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.CREATED)
  async updatePhone(
    @Req() request: FastifyRequest,
    @Body() body: StartPhoneVerificationDto,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.updatePhone(
      session,
      body.phoneNumber,
      body.channel,
    );
  }

  @Post('update-phone/verify')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyPhone(
    @Req() request: FastifyRequest,
    @Body() body: VerifyPhoneVerificationDto,
    @Body('token', new ParseNanoidPipe(16)) token: string,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.verifyPhone(
      session,
      significantRequestInformation(request),
      body.phoneNumber,
      token,
      body.code,
    );
  }

  @Post('update-phone/resend')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.CREATED)
  async resendPhoneVerification(
    @Req() request: FastifyRequest,
    @Body() body: ResendPhoneVerificationDto,
    @Body('token', new ParseNanoidPipe(16)) token: string,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.resendPhoneVerification(
      session,
      body.phoneNumber,
      token,
      body.channel,
    );
  }

  @Post('update-email')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.CREATED)
  async updateEmail(
    @Req() request: FastifyRequest,
    @Body() body: UpdateEmailDto,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.updateEmail(
      body.email,
      session,
      significantRequestInformation(request),
    );
  }

  @Post('update-email/verify')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyUpdateEmail(
    @Req() request: FastifyRequest,
    @Body() body: VerifyUpdateEmailDto,
    @Body('token', new ParseNanoidPipe(16)) token: string,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.verifyUpdateEmail(
      session,
      significantRequestInformation(request),
      token,
      body.email,
      body.code,
    );
  }

  @Post('update-email/resend')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.CREATED)
  async resendUpdateEmail(
    @Req() request: FastifyRequest,
    @Body() body: UpdateEmailDto,
    @Body('token', new ParseNanoidPipe(16)) token: string,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.resendUpdateEmail(
      session,
      body.email,
      token,
      significantRequestInformation(request),
    );
  }

  @Patch('update-password')
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.OK)
  async updatePassword(
    @Req() request: FastifyRequest,
    @Body() body: UpdatePasswordDto,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.updatePassword(
      session,
      significantRequestInformation(request),
      body,
    );
  }

  @Patch()
  @Authorization(AccessLevel.MEDIUM)
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(@Req() request: FastifyRequest, @Body() body: UpdateAccountDto) {
    console.log(body);
    const session: SessionEntity = (request as any).session;
    return this.accountService.update(
      session,
      significantRequestInformation(request),
      body,
    );
  }
}
