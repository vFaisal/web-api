import { Module } from "@nestjs/common";
import { AccountService } from "./account.service";
import { AccountController } from "./account.controller";
import { SessionsModule } from "./sessions/sessions.module";


@Module({
  controllers: [AccountController],
  providers: [AccountService],
  imports: [SessionsModule]
})
export class AccountModule {
}
