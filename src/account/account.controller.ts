import { AccountService } from './account.service';
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
import { AuthGuard } from '../auth/auth.guard';
import SessionEntity from '../auth/entities/session.entity';
import { FastifyRequest } from 'fastify';
import StartPhoneVerificationDto from './dto/start-phone-verification.dto';
import ParseNanoidPipe from '../shared/pipes/parse-nanoid.pipe';
import VerifyPhoneVerificationDto from './dto/verify-phone-verification.dto';
import ResendPhoneVerification from './dto/resend-phone-verification';

@Controller({
  path: 'account',
  version: '1',
})
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  getAccount(@Req() request) {
    const session: SessionEntity = request.session;
    return this.accountService.getSafeAccountData(session.getAccount().id);
  }

  @Put('photo')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async uploadPhoto(@Req() request: FastifyRequest) {
    const file = await request.file();
    const session: SessionEntity = (request as any).session;
    return this.accountService.uploadPhoto(file, session);
  }

  @Delete('photo')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePhoto(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.deletePhoto(session);
  }

  @Post('phone/start-verification')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async startPhoneVerification(
    @Req() request: FastifyRequest,
    @Body() body: StartPhoneVerificationDto,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.startPhoneVerification(
      session,
      body.phoneNumber,
      body.channel,
    );
  }

  @Post('phone/verify')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async verifyPhone(
    @Req() request: FastifyRequest,
    @Body() body: VerifyPhoneVerificationDto,
    @Body('token', new ParseNanoidPipe(16)) token: string,
  ) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.verifyPhone(
      session,
      body.phoneNumber,
      token,
      body.code,
    );
  }

  @Post('phone/resend')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async resendPhoneVerification(
    @Req() request: FastifyRequest,
    @Body() body: ResendPhoneVerification,
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
}
