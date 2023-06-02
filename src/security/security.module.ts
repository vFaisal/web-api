import { Global, Module } from "@nestjs/common";
import CSRFService from "./csrf.service";
import PKCEService from "./pkce.service";

@Global()
@Module({
  providers: [CSRFService, PKCEService],
  exports: [CSRFService, PKCEService]
})
export default class SecurityModule {
}
