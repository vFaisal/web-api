import { AccountService } from "./account.service";
import {
  Controller, Delete,
  Get,
  HttpCode, Put,
  Req,
  UseGuards
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import SessionEntity from "../auth/entities/session.entity";
import { FastifyRequest } from "fastify";

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
    return this.accountService.getSafeAccountData(session.accountId);
  }

  @Put("photo")
  @UseGuards(AuthGuard)
  @HttpCode(201)
  async uploadPhoto(@Req() request: FastifyRequest) {
    const file = await request.file();
    const session: SessionEntity = (request as any).session;
    return this.accountService.uploadPhoto(file, session);
  }

  @Delete("photo")
  @UseGuards(AuthGuard)
  @HttpCode(201)
  async deletePhoto(@Req() request: FastifyRequest) {
    const session: SessionEntity = (request as any).session;
    return this.accountService.deletePhoto(session);
  }
}
