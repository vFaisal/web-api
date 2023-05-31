import { forwardRef, Module } from "@nestjs/common";
import { FederatedIdentitiesService } from "./federated-identities.service";
import { FederatedIdentitiesController } from "./federated-identities.controller";
import { GoogleModule } from "./google/google.module";
import { AuthModule } from "../auth.module";
import { AuthService } from "../auth.service";
import { MicrosoftModule } from './microsoft/microsoft.module';

@Module({
  controllers: [FederatedIdentitiesController],
  providers: [FederatedIdentitiesService],
  imports: [GoogleModule, forwardRef(() => AuthModule), MicrosoftModule],
  exports: [FederatedIdentitiesService]
})
export class FederatedIdentitiesModule {
}
