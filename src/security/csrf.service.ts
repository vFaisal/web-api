import { FastifyReply, FastifyRequest } from "fastify";
import { generateNanoId, unixTimestamp } from "../utils/util";
import { ConfigService } from "@nestjs/config";
import RedisService from "../providers/redis.service";
import { Injectable } from "@nestjs/common";


@Injectable()
export default class CSRFService {

  public static readonly EXPIRATION = 60 * 15;

  constructor(private kv: RedisService, private config: ConfigService) {
  }

  public async create(req: FastifyRequest, res: FastifyReply, suffix: string): Promise<string> {
    const cookie = req.cookies?.[`x_csrf_${suffix}`];
    const clientCachedCSRF = cookie ? req.unsignCookie(req.cookies?.[`x_csrf_${suffix}`]) : null;
    console.log(clientCachedCSRF);
    
    if (clientCachedCSRF?.valid) {
      const serverCachedCSRF: {
        token: string,
        expires: number
      } | null = await this.kv.get(`csrf_${suffix}:${clientCachedCSRF.value}`);
      if (serverCachedCSRF && serverCachedCSRF.expires - 180 > unixTimestamp()) return serverCachedCSRF.token;
    }

    const token = generateNanoId(64);
    const signature = generateNanoId(32);
    await this.kv.setex(`csrf_${suffix}:${signature}`, CSRFService.EXPIRATION, {
      token,
      expires: unixTimestamp(CSRFService.EXPIRATION)
    });

    //Set csrf signature to client cookie
    res.setCookie(`x_csrf_${suffix}`, signature, {
      expires: unixTimestamp(CSRFService.EXPIRATION, "DATE"),
      httpOnly: true,
      secure: (this.config.getOrThrow("NODE_ENV") === "production"),
      domain: ".faisal.gg",
      path: "/",
      signed: true
    });

    return token;
  }
}
