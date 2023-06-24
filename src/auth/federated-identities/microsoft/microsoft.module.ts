import { forwardRef, Module } from '@nestjs/common';
import { MicrosoftService } from './microsoft.service';
import { MicrosoftController } from './microsoft.controller';
import { FederatedIdentitiesModule } from '../federated-identities.module';

@Module({
  controllers: [MicrosoftController],
  providers: [MicrosoftService],
  imports: [forwardRef(() => FederatedIdentitiesModule)],
})
export class MicrosoftModule {}
