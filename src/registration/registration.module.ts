import { Module } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';
import { VerificationModule } from './verification/verification.module';

@Module({
  controllers: [RegistrationController],
  providers: [RegistrationService],
  imports: [VerificationModule]
})
export class RegistrationModule {}
