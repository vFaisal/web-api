import { Global, Module } from '@nestjs/common';
import PhoneVerificationService from './phone-verification.service';
import EmailVerificationService from './email-verification.service';
import TotpService from './totp.service';

@Global()
@Module({
  providers: [PhoneVerificationService, EmailVerificationService, TotpService],
  exports: [PhoneVerificationService, EmailVerificationService, TotpService],
})
export default class ServicesModule {}
