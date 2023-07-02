import { Global, Module } from '@nestjs/common';
import RedisService from './redis.service';
import { PrismaService } from './prisma.service';
import SendgridService from './sendgrid.service';
import R2Service from './r2.service';
import TwilioService from './twilio.service';

@Global()
@Module({
  providers: [
    RedisService,
    PrismaService,
    SendgridService,
    R2Service,
    TwilioService,
  ],
  exports: [
    RedisService,
    PrismaService,
    SendgridService,
    R2Service,
    TwilioService,
  ],
})
export class ProvidersModule {}
