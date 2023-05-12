import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { AccountModule } from "./account/account.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "./prisma.service";
import { RegistrationModule } from "./registration/registration.module";
import { LoggerMiddleware } from "./middleware/logger.middleware";
import { JwtModule } from "@nestjs/jwt";

@Global()
@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true
  }), CacheModule.register({
    isGlobal: true
  }),
    JwtModule.register({
      global: true
    }), AccountModule, AuthModule, RegistrationModule, AuthModule],
  controllers: [],
  providers: [PrismaService],
  exports: [PrismaService]

})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
