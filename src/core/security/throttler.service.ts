import { HttpException, Injectable } from '@nestjs/common';
import RedisService from '../providers/redis.service';

@Injectable()
export default class ThrottlerService {
  constructor(private readonly kv: RedisService) {}

  public async isRateLimited(key: string, ttl: number, limit: number) {
    const cache = await this.kv.get<Throttler>('ratelimit:' + key);
    if (cache?.times >= limit) return true;

    await this.kv.setex('ratelimit:' + key, ttl, {
      times: cache ? cache.times + 1 : 1,
    });

    return false;
  }

  public async throwIfRateLimited(
    key: string,
    ttl: number,
    limit: number,
    messageType: 'account' | 'data' | 'global',
  ) {
    if (await this.isRateLimited(key, ttl, limit))
      throw new HttpException(
        {
          code: 'rate_limit_exceeded',
          message:
            messageType === 'account'
              ? 'The request rate for your account has reached its maximum limit. To maintain service stability and ensure equitable access for all users, kindly refrain from making further requests until the specified time has elapsed.'
              : messageType === 'data'
              ? 'Your request has been throttled due to exceeding the rate limit for one of the data fields in the request body. Please reduce the frequency of requests for this data field and try again after the specified duration.'
              : 'Your request has been throttled due to exceeding the global maximum allowed request limit. To ensure fair usage and maintain service quality for all users, please reduce the frequency of your requests and try again after the specified duration.',
        },
        429,
      );
  }
}

interface Throttler {
  times: number;
}
