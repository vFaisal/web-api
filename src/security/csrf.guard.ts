import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import RedisService from "../providers/redis.service";


@Injectable()
export default class CSRFGuard implements CanActivate {
  constructor(private kv: RedisService, private reflector: Reflector) {
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const suffix = this.reflector.get<string>("csrfSuffix", context.getHandler());
    const request = context.switchToHttp().getRequest();

    const token = this.extractTokenFromQuery(request);
    const signature = this.extractSignatureFromCookie(request, suffix);

    console.log(token);
    console.log(signature);

    if (!token || !signature) throw new BadRequestException({
      code: "csrf_required",
      message: "This endpoint requires a CSRF policy to be included in the request. Please provide a valid policy and try again."
    });

    const csrf: { token: string, expires: number } | null = await this.kv.get(`csrf_${suffix}:${signature}`);


    if (!csrf || csrf.token !== token) throw new BadRequestException({
      code: "invalid_csrf",
      message: "The request you sent was rejected due to an invalid CSRF token. Please ensure that the token you are using is up to date and try again."
    });

    return true;
  }


  private extractTokenFromQuery(request: FastifyRequest): string | null {
    const token = request.query?.["state"];
    return typeof token === "string" && token.length === 64 ? token : null;
  }

  private extractSignatureFromCookie(request: FastifyRequest, suffix: string): string | null {
    const signature = request.cookies?.[`x_csrf_${suffix}`];
    const unsignedSignature = typeof signature === "string" ? request.unsignCookie(signature) : null;
    return unsignedSignature?.valid ? unsignedSignature.value : null;
  }
}
