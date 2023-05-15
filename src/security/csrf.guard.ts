import {
  BadRequestException, CACHE_MANAGER,
  CanActivate,
  ExecutionContext, Inject,
  Injectable,
  Logger,
  ServiceUnavailableException, UnprocessableEntityException
} from "@nestjs/common";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Cache } from "cache-manager";
import { FastifyRequest } from "fastify";


@Injectable()
export default class CSRFGuard implements CanActivate {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache, private reflector: Reflector) {
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const suffix = this.reflector.get<string>("csrfSuffix", context.getHandler());
    if (!suffix) {
      Logger.error("CSRF suffix decorator is required for CSRF protection");
      throw new ServiceUnavailableException();
    }
    const request = context.switchToHttp().getRequest();

    const token = this.extractTokenFromQuery(request);
    const signature = this.extractSignatureFromCookie(request, suffix);

    if (!token || !signature) throw new BadRequestException({
      code: "csrf_required",
      message: "This endpoint requires a CSRF policy to be included in the request. Please provide a valid policy and try again."
    });

    const csrf: { token: string, expires: number } | null = await this.cache.get(`csrf_${suffix}:${signature}`);


    if (!csrf || csrf.token !== token) throw new BadRequestException({
      code: "invalid_csrf",
      message: "The request you sent was rejected due to an invalid CSRF token. Please ensure that the token you are using is up to date and try again."
    });

    return true;
  }


  private extractTokenFromQuery(request: FastifyRequest): string | null {
    const token = request.query?.["state"];
    return typeof token === "string" && token.length === 128 ? token : null;
  }

  private extractSignatureFromCookie(request: FastifyRequest, suffix: string): string | null {
    const signature = request.cookies?.[`x_csrf_${suffix}`];
    const unsignedSignature = typeof signature === "string" ? request.unsignCookie(signature) : null;
    return unsignedSignature?.valid ? unsignedSignature.value : null;
  }
}
