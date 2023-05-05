import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, VERSION_NEUTRAL, VersioningType } from "@nestjs/common";
import helmet from "helmet";
import { PrismaService } from "./prisma.service";

(async () => {
  const app = await NestFactory.create(AppModule, {
    logger: ["debug", "error", "warn", "log", "verbose"]
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    disableErrorMessages: false
  }));
  app.use(helmet.hidePoweredBy()).enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL
  });
  await app.get(PrismaService).enableShutdownHooks(app);
  await app.listen(2000);
})();
