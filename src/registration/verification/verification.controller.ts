import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { VerificationService } from './verification.service';
import CreateEmailVerificationDto from './dto/create-email-verification.dto';
import VerifyEmailDto from './dto/verify-email.dto';
import { Recaptcha } from '../../core/security/recaptch.decorator';
import { FastifyRequest } from 'fastify';
import ParseNanoidPipe from '../../shared/pipes/parse-nanoid.pipe';
import ResendEmailVerificationDto from './dto/resend-email-verification.dto';

@Controller({
  path: 'registration/verification',
  version: '1',
})
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('/email')
  @HttpCode(HttpStatus.CREATED)
  @Recaptcha('registration')
  root(@Body() body: CreateEmailVerificationDto, @Req() req: FastifyRequest) {
    return this.verificationService.createEmailVerification(body.email, req.ip);
  }

  @Post('/email/resend')
  @HttpCode(HttpStatus.CREATED)
  resend(
    @Body() body: ResendEmailVerificationDto,
    @Body('token', new ParseNanoidPipe(64)) token: string,
  ) {
    return this.verificationService.resendEmailVerification(body, token);
  }

  @Patch('/email')
  @HttpCode(HttpStatus.NO_CONTENT)
  verifyEmail(
    @Body() body: VerifyEmailDto,
    @Body('token', new ParseNanoidPipe(64)) token: string,
  ) {
    return this.verificationService.verifyEmail(body, token);
  }
}
