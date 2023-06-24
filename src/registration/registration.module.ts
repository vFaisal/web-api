import { Module } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';
import { VerificationModule } from './verification/verification.module';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  controllers: [RegistrationController],
  providers: [RegistrationService],
  imports: [VerificationModule, AuthModule],
})
export class RegistrationModule {}
