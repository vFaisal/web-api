import {
  CACHE_MANAGER, CacheStore,
  CanActivate,
  ExecutionContext, ForbiddenException, Inject,
  Injectable,
  Logger,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as process from "process";
import { Request } from "express";
import { PrismaService } from "../prisma.service";
import SessionEntity from "./entities/session.entity";
import { Cache } from "cache-manager";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private prisma: PrismaService, private config: ConfigService, @Inject(CACHE_MANAGER) private cache: Cache) {
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(context.switchToHttp().getRequest());
    if (!token)
      throw new UnauthorizedException();


    await this.jwtService.verifyAsync(
      token,
      {
        secret: this.config.get("JWT_256_SECRET"),
        algorithms: ["HS256"]

      }
    ).catch((err) => {
      Logger.debug(err);
      throw new UnauthorizedException();
    });

    //Check the session is valid in cache (We add await if we want to use cache service like redis);
    const session = new SessionEntity(await this.cache.get(`session:${token}`));
    console.log(session);
    if (!session.isValid()) throw new UnauthorizedException();

    request["accountPublicId"] = session.accountPublicId;

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" && typeof token === "string" ? token : undefined;
  }
}
