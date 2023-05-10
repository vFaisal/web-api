import { Module } from "@nestjs/common";
import { GoogleService } from "./google.service";
import { GoogleController } from "./google.controller";
import { AuthModule } from "../../auth.module";

@Module({
  controllers: [GoogleController],
  providers: [GoogleService],
  imports: [AuthModule]
})
export class GoogleModule {
}
