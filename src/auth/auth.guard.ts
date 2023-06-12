import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { PrismaService } from "../providers/prisma.service";
import SessionEntity from "./entities/session.entity";
import { ConfigService } from "@nestjs/config";
import RedisService from "../providers/redis.service";
import { AppJWTPayload } from "./auth.service";

@Injectable()
export class AuthGuard implements CanActivate {

  private logger: Logger = new Logger("AuthGuard");

  constructor(private readonly jwtService: JwtService, private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly kv: RedisService) {
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(context.switchToHttp().getRequest());
    if (!token)
      throw new UnauthorizedException();


    const payload: AppJWTPayload = await this.jwtService.verifyAsync(
      token,
      {
        secret: this.config.getOrThrow("JWT_256_SECRET"),
        algorithms: ["HS256"]

      }
    ).catch((err) => {
      this.logger.debug("Auth Guard", err);
      throw new UnauthorizedException();
    });

    //Check the sessions is valid in cache (We add await if we want to use cache service like redis);
    const session = new SessionEntity(await this.kv.get(`session:${payload.spi}`));
    if (!session.isValid()) throw new UnauthorizedException();

    request.session = session;


    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" && typeof token === "string" ? token : undefined;
  }
}
