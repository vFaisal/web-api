import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { FederatedIdentitiesModule } from './federated-identities/federated-identities.module';
import { MultiFactorModule } from './multi-factor/multi-factor.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
  imports: [FederatedIdentitiesModule, MultiFactorModule],
})
export class AuthModule {}
