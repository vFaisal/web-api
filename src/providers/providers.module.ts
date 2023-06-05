import { Global, Module } from "@nestjs/common";
import RedisService from "./redis.service";
import { PrismaService } from "./prisma.service";
import SendgridService from "./sendgrid.service";

@Global()
@Module({
  providers: [RedisService, PrismaService, SendgridService],
  exports: [RedisService, PrismaService, SendgridService]
})
export class ProvidersModule {
}
