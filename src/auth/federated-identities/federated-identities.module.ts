import { forwardRef, Module } from "@nestjs/common";
import { FederatedIdentitiesService } from "./federated-identities.service";
import { FederatedIdentitiesController } from "./federated-identities.controller";
import { GoogleModule } from "./google/google.module";
import { AuthModule } from "../auth.module";
import { AuthService } from "../auth.service";
import { MicrosoftModule } from "./microsoft/microsoft.module";
import { FacebookModule } from "./facebook/facebook.module";
import { GithubModule } from "./github/github.module";
import { TwitterModule } from "./twitter/twitter.module";

@Module({
  controllers: [FederatedIdentitiesController],
  providers: [FederatedIdentitiesService],
  imports: [GoogleModule, forwardRef(() => AuthModule), MicrosoftModule, GithubModule, TwitterModule, FacebookModule],
  exports: [FederatedIdentitiesService]
})
export class FederatedIdentitiesModule {
}
