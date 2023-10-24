import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AccountModule } from './account/account.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { RegistrationModule } from './registration/registration.module';
import { JwtModule } from '@nestjs/jwt';
import SecurityModule from './core/security/security.module';
import { AppController } from './app.controller';
import { ProvidersModule } from './core/providers/providers.module';
import ServicesModule from './core/services/services.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({
      global: true,
    }),
    ProvidersModule,
    ServicesModule,
    SecurityModule,
    AccountModule,
    AuthModule,
    RegistrationModule
    /*, ThrottlerModule*/,
  ],
  controllers: [AppController],
})
export class AppModule /*implements NestModule*/ {
  /*configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }*/
}
