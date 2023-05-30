import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import RedisService from "../providers/redis.service";
import CSRFService from "./csrf.service";


@Injectable()
export default class CSRFGuard implements CanActivate {
  constructor(private reflector: Reflector, private csrfService: CSRFService) {
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const suffix = this.reflector.get<string>("csrfSuffix", context.getHandler());
    const request = context.switchToHttp().getRequest();

    const token = this.extractTokenFromQuery(request);
    const secret = this.extractSecretFromCookie(request, suffix);

    if (!token || !secret) throw new BadRequestException({
      code: "csrf_required",
      message: "This endpoint requires a CSRF policy to be included in the request. Please provide a valid policy and try again."
    });

    if (!this.csrfService.dep.verify(secret, token)) throw new BadRequestException({
      code: "invalid_csrf",
      message: "The request you sent was rejected due to an invalid CSRF token. Please ensure that the token you are using is up to date and try again."
    });

    return true;
  }


  private extractTokenFromQuery(request: FastifyRequest): string | null {
    const token = request.query?.["state"];
    return this.csrfService.validateTokenLength(token) ? token : null;
  }

  private extractSecretFromCookie(request: FastifyRequest, suffix: string): string | null {
    const secret = request.cookies?.[`x_csrf_${suffix}`];
    return this.csrfService.validateSecretLength(secret) ? secret : null;
  }
}
