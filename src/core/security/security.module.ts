import { Global, Module } from '@nestjs/common';
import CSRFService from './csrf.service';
import PKCEService from './pkce.service';
import ThrottlerService from './throttler.service';

@Global()
@Module({
  providers: [CSRFService, PKCEService, ThrottlerService],
  exports: [CSRFService, PKCEService, ThrottlerService],
})
export default class SecurityModule {}
