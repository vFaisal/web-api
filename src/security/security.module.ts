import { Global, Module } from "@nestjs/common";
import CSRFService from "./csrf.service";

@Global()
@Module({
  providers: [CSRFService],
  exports: [CSRFService]
})
export default class SecurityModule {
}
