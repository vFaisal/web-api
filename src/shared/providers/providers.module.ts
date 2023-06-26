import { Global, Module } from '@nestjs/common';
import RedisService from './redis.service';
import { PrismaService } from './prisma.service';
import SendgridService from './sendgrid.service';
import R2Service from './r2.service';

@Global()
@Module({
  providers: [RedisService, PrismaService, SendgridService, R2Service],
  exports: [RedisService, PrismaService, SendgridService, R2Service],
})
export class ProvidersModule {}
