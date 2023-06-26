import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { VerificationService } from './verification.service';
import CreateEmailVerificationDto from './dto/create-email-verification.dto';
import VerifyEmailDto from './dto/verify-email.dto';
import { Recaptcha } from '../../shared/security/recaptch.decorator';

@Controller({
  path: 'registration/verification',
  version: '1',
})
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('/email')
  @HttpCode(HttpStatus.CREATED)
  @Recaptcha('registration')
  root(@Body() body: CreateEmailVerificationDto) {
    return this.verificationService.createEmailVerification(body.email);
  }

  @Patch('/email')
  @HttpCode(HttpStatus.NO_CONTENT)
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.verificationService.verifyEmail(body);
  }
}
