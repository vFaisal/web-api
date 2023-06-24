import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { FederatedIdentitiesModule } from './federated-identities/federated-identities.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
  imports: [FederatedIdentitiesModule],
})
export class AuthModule {}
