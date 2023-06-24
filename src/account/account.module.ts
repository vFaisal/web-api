import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { SessionsModule } from './sessions/sessions.module';
import { TwoFactorModule } from './two-factor/two-factor.module';

@Module({
  controllers: [AccountController],
  providers: [AccountService],
  imports: [SessionsModule, TwoFactorModule],
  exports: [AccountService],
})
export class AccountModule {}
