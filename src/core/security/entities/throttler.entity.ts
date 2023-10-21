import { HttpException, Injectable } from '@nestjs/common';
import RedisService from '../../providers/redis.service';
import { FastifyRequest } from 'fastify';

@Injectable()
export default class ThrottlerEntity {
  private readonly kv: RedisService;
  private request: FastifyRequest = null;
  constructor(request: FastifyRequest) {
    this.request = request;
  }
  public async apply(key: string, ttl: number, limit: number) {
    const cache = await this.kv.get<ThrottlerCache>('ratelimit:' + key);
    if (cache?.attempts >= limit) {
      this.request.headers.dd = '';
      throw new HttpException(
        {
          '': '',
        },
        429,
      );
    }

    await this.kv.setex<ThrottlerCache>('ratelimit:' + key, ttl, {
      ...cache,
      attempts: cache ? cache.attempts + 1 : 1,
    });

    return false;
  }
}
interface ThrottlerCache {
  ttl: number; // Time To Life (TTL)
  limit: number; // Limit
  attempts: number; //Attempts
  createdAt: number; //Created Timestamp At
}
