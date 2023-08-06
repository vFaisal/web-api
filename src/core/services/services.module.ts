import { Global, Module } from '@nestjs/common';
import PhoneVerificationService from './phone-verification.service';
import EmailVerificationService from './email-verification.service';

@Global()
@Module({
  providers: [PhoneVerificationService, EmailVerificationService],
  exports: [PhoneVerificationService, EmailVerificationService],
})
export default class ServicesModule {}
