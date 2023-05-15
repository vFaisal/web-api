import { AccountService } from "./account.service";
import {
  Controller,
  Get,
  HttpCode,
  Req,
  UseGuards
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import SessionEntity from "../auth/entities/session.entity";

@Controller({
  path: "account",
  version: "1"
})
export class AccountController {
  constructor(private readonly accountService: AccountService) {
  }

  @Get()
  @UseGuards(AuthGuard)
  @HttpCode(200)
  getAccount(@Req() request) {
    const session: SessionEntity = request.session;
    return this.accountService.getAccount(session.accountPublicId);
  }
}
