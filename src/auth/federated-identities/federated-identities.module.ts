import { Module } from '@nestjs/common';
import { FederatedIdentitiesService } from './federated-identities.service';
import { FederatedIdentitiesController } from './federated-identities.controller';
import { GoogleModule } from './google/google.module';

@Module({
  controllers: [FederatedIdentitiesController],
  providers: [FederatedIdentitiesService],
  imports: [GoogleModule]
})
export class FederatedIdentitiesModule {}
