import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../core/providers/prisma.service';
import SessionEntity from './entities/session.entity';
import { ConfigService } from '@nestjs/config';
import RedisService from '../core/providers/redis.service';
import { AppJWTPayload } from './auth.service';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { AccessLevel } from '../core/security/authorization.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private logger: Logger = new Logger('AuthGuard');

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly kv: RedisService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const level = this.reflector.get<AccessLevel>(
      'level',
      context.getHandler(),
    );
    if (level === undefined) {
      this.logger.error(
        `${request.routerPath} Route not setup Authorization Level`,
      );
      throw new InternalServerErrorException();
    }
    const token = this.extractTokenFromHeader(
      context.switchToHttp().getRequest(),
    );
    if (!token) throw new UnauthorizedException();

    const payload: AppJWTPayload = await this.jwtService
      .verifyAsync(token, {
        secret: this.config.getOrThrow('JWT_256_SECRET'),
        algorithms: ['HS256'],
      })
      .catch((err) => {
        this.logger.debug('Auth Guard', err);
        throw new UnauthorizedException();
      });

    //Check the sessions is valid in cache (We add await if we want to use cache service like redis);
    const session = new SessionEntity(
      await this.kv.get(`session:${payload.spi}`),
    );
    if (!session.isValid()) throw new UnauthorizedException();

    request.session = session;

    if (
      (level === AccessLevel.HIGH &&
        session.getAccessLevel() !== AccessLevel.HIGH) ||
      (level === AccessLevel.MEDIUM &&
        session.getAccessLevel() !== AccessLevel.MEDIUM)
    )
      throw new ForbiddenException();

    return true;
  }

  private extractTokenFromHeader(request: FastifyRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && typeof token === 'string' ? token : undefined;
  }
}
