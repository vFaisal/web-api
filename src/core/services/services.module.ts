import { Global, Module } from '@nestjs/common';
import PhoneVerificationService from './phone-verification.service';
import EmailVerificationService from './email-verification.service';
import TotpService from './totp.service';
import PasswordValidationService from './password-validation.service';
import SessionService from './session.service';

@Global()
@Module({
  providers: [
    PhoneVerificationService,
    EmailVerificationService,
    TotpService,
    PasswordValidationService,
    SessionService,
  ],
  exports: [
    PhoneVerificationService,
    EmailVerificationService,
    TotpService,
    PasswordValidationService,
    SessionService,
  ],
})
export default class ServicesModule {}
