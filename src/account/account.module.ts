import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { SessionsModule } from './sessions/sessions.module';
import { MultiFactorModule } from './multi-factor/multi-factor.module';
import { LinkModule } from './link/link.module';
import { AccessModule } from './access/access.module';

@Module({
  controllers: [AccountController],
  providers: [AccountService],
  imports: [SessionsModule, MultiFactorModule, LinkModule, AccessModule],
  exports: [AccountService],
})
export class AccountModule {}
