import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, VercelKV, kv } from '@vercel/kv';

@Injectable()
export default class RedisService extends VercelKV {
  constructor(private config: ConfigService) {
    super({
      url: config.getOrThrow('UPSTASH_REDIS_REST_URL'),
      token: config.getOrThrow('UPSTASH_REDIS_REST_TOKEN'),
    });
  }
}
