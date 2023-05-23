import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";

@Controller({
  version: "1"
})
export class AppController {

  @Get()
  @HttpCode(204)
  root() {
    return;
  }
}
