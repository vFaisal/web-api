import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { SessionsModule } from './sessions/sessions.module';
import { MultiFactorModule } from './multi-factor/multi-factor.module';

@Module({
  controllers: [AccountController],
  providers: [AccountService],
  imports: [SessionsModule, MultiFactorModule],
  exports: [AccountService],
})
export class AccountModule {}
