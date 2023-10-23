import { Global, Module } from '@nestjs/common';
import RedisService from './redis.service';
import { PrismaService } from './prisma.service';
import SendgridService from './sendgrid.service';
import R2Service from './r2.service';
import TwilioService from './twilio.service';
import OpenaiService from './openai.service';
import ResendService from './resend.service';

@Global()
@Module({
  providers: [
    RedisService,
    PrismaService,
    SendgridService,
    R2Service,
    TwilioService,
    OpenaiService,
    ResendService,
  ],
  exports: [
    RedisService,
    PrismaService,
    SendgridService,
    R2Service,
    TwilioService,
    OpenaiService,
    ResendService,
  ],
})
export class ProvidersModule {}
