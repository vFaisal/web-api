import { forwardRef, Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { GoogleController } from './google.controller';
import { FederatedIdentitiesModule } from '../federated-identities.module';

@Module({
  controllers: [GoogleController],
  providers: [GoogleService],
  imports: [forwardRef(() => FederatedIdentitiesModule)],
})
export class GoogleModule {}
