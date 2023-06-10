import { Controller, Delete, Get, HttpCode, HttpStatus, Req, UseGuards } from "@nestjs/common";
import { SessionsService } from "./sessions.service";
import { AuthGuard } from "../../auth/auth.guard";
import { FastifyRequest } from "fastify";
import UAParser from "ua-parser-js";
import SessionEntity from "../../auth/entities/session.entity";

@Controller({
  path: "account/sessions",
  version: "1"
})
export class SessionsController {
  constructor(private readonly sessionService: SessionsService) {
  }

  @Get()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  getSessions(@Req() request: FastifyRequest) {
    console.log(request.headers["user-agent"]);
    // console.log(new UAParser(request.headers["user-agent"]));
    const session: SessionEntity = (request as any).session;
    return this.sessionService.getAll(session);
  }

  @Delete()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSessions() {
  }

  @Delete(":id")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSession() {
  }

}
