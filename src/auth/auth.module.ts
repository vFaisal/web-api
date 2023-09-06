import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { FederatedIdentitiesModule } from './federated-identities/federated-identities.module';
import { MultiFactorModule } from './multi-factor/multi-factor.module';
import { SessionModule } from './session/session.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
  imports: [
    forwardRef(() => FederatedIdentitiesModule),
    MultiFactorModule,
    SessionModule,
  ],
})
export class AuthModule {}
