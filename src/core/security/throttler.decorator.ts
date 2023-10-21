import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import ThrottlerEntity from './entities/throttler.entity';
import RedisService from '../providers/redis.service';
import { AuthGuard } from '../../auth/auth.guard';
import { AccessLevel } from './authorization.decorator';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    request.throttler = new ThrottlerEntity(request);
    return request.throttler;
  },
);

export function Gre(level: AccessLevel) {
  return applyDecorators(User, UseGuards(AuthGuard));
}
