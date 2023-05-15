import { NestFactory, Reflector } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ClassSerializerInterceptor, ValidationPipe, VERSION_NEUTRAL, VersioningType } from "@nestjs/common";
import helmet from "helmet";
import { PrismaService } from "./prisma.service";
import fastifyCookie from "@fastify/cookie";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import * as process from "process";

(async () => {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: ["debug", "error", "warn", "log", "verbose"]
  });
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    disableErrorMessages: false
  }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.use(helmet.hidePoweredBy());
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL
  });
  await app.get(PrismaService).enableShutdownHooks(app);
  await app.listen(process.env.PORT);
})();
