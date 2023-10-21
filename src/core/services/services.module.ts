import { Global, Module } from '@nestjs/common';
import PhoneVerificationGlobalService from './phone-verification.global.service';
import EmailVerificationGlobalService from './email-verification.global.service';
import TotpGlobalService from './totp.global.service';
import PasswordValidationGlobalService from './password-validation.global.service';
import SessionGlobalService from './session.global.service';
import AccountActivityGlobalService from './account-activity.global.service';

@Global()
@Module({
  providers: [
    PhoneVerificationGlobalService,
    EmailVerificationGlobalService,
    TotpGlobalService,
    PasswordValidationGlobalService,
    SessionGlobalService,
    AccountActivityGlobalService,
  ],
  exports: [
    PhoneVerificationGlobalService,
    EmailVerificationGlobalService,
    TotpGlobalService,
    PasswordValidationGlobalService,
    SessionGlobalService,
    AccountActivityGlobalService,
  ],
})
export default class ServicesModule {}
