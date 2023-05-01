import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {ValidationPipe, VERSION_NEUTRAL, VersioningType} from "@nestjs/common";
import helmet from "helmet";

(async () => {
    await (await NestFactory.create(AppModule, {
        logger: ["debug", "error", "warn", "log", "verbose"]
    })).useGlobalPipes(new ValidationPipe({
        whitelist: true,
        disableErrorMessages: false,
    })).use(helmet.hidePoweredBy()).enableVersioning({
        type: VersioningType.URI,
        defaultVersion: VERSION_NEUTRAL
    }).listen(2000);
})()
