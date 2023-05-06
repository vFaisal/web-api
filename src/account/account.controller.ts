import { AccountService } from "./account.service";
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Request } from "express";

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
    return this.accountService.getAccount(request.accountPublicId);
  }
}
