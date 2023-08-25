import { forwardRef, Module } from '@nestjs/common';
import { GithubService } from './github.service';
import { GithubController } from './github.controller';
import { FederatedIdentitiesModule } from '../federated-identities.module';

@Module({
  controllers: [GithubController],
  providers: [GithubService],
  imports: [forwardRef(() => FederatedIdentitiesModule)],
  exports: [GithubService],
})
export class GithubModule {}
