import { forwardRef, Module } from '@nestjs/common';
import { FacebookService } from './facebook.service';
import { FacebookController } from './facebook.controller';
import { FederatedIdentitiesModule } from '../federated-identities.module';

@Module({
  controllers: [FacebookController],
  providers: [FacebookService],
  imports: [forwardRef(() => FederatedIdentitiesModule)],
  exports: [FacebookService],
})
export class FacebookModule {}
