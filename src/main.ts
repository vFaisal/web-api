import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {PrismaClient} from "@prisma/client";

(async () => {
    const app = await NestFactory.create(AppModule);
    await app.listen(2000);
})()


export const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});
