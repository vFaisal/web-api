import { Global, Module } from '@nestjs/common';
import PhoneVerificationService from './phone-verification.service';

@Global()
@Module({
  providers: [PhoneVerificationService],
  exports: [PhoneVerificationService],
})
export default class ServicesModule {}
