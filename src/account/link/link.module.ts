import { Module } from '@nestjs/common';
import { LinkService } from './link.service';
import { LinkController } from './link.controller';
import { GoogleModule } from '../../auth/federated-identities/google/google.module';
import { GoogleService } from '../../auth/federated-identities/google/google.service';
import { FederatedIdentitiesModule } from '../../auth/federated-identities/federated-identities.module';
import { FacebookModule } from '../../auth/federated-identities/facebook/facebook.module';
import { MicrosoftModule } from '../../auth/federated-identities/microsoft/microsoft.module';
import { TwitterModule } from '../../auth/federated-identities/twitter/twitter.module';
import { GithubModule } from '../../auth/federated-identities/github/github.module';

@Module({
  controllers: [LinkController],
  providers: [LinkService],
  imports: [
    GoogleModule,
    FederatedIdentitiesModule,
    FacebookModule,
    MicrosoftModule,
    TwitterModule,
    GithubModule,
  ],
})
export class LinkModule {}
