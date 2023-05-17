import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { AccountModule } from "./account/account.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "./prisma.service";
import { RegistrationModule } from "./registration/registration.module";
import { JwtModule } from "@nestjs/jwt";
import SecurityModule from "./security/security.module";

@Global()
@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true
  }), CacheModule.register({
    isGlobal: true
  }),
    JwtModule.register({
      global: true
    }), SecurityModule, AccountModule, AuthModule, RegistrationModule, AuthModule/*, ThrottlerModule*/],
  controllers: [],
  providers: [PrismaService],
  exports: [PrismaService]

})
export class AppModule /*implements NestModule*/ {
  /*configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }*/
}
