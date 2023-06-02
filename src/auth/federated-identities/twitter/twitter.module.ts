import { forwardRef, Module } from "@nestjs/common";
import { TwitterService } from "./twitter.service";
import { TwitterController } from "./twitter.controller";
import { FederatedIdentitiesModule } from "../federated-identities.module";

@Module({
  controllers: [TwitterController],
  providers: [TwitterService],
  imports: [forwardRef(() => FederatedIdentitiesModule)]

})
export class TwitterModule {
}
