import { BadRequestException, CACHE_MANAGER, Inject } from "@nestjs/common";
import { Cache } from "cache-manager";
import { FastifyReply, FastifyRequest } from "fastify";
import { generateNanoId, unixTimestamp } from "../utils/util";


export default class CSRFService {

  public static readonly EXPIRATION = 60 * 15;

  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {
  }

  public async create(req: FastifyRequest, res: FastifyReply, suffix: string): Promise<string> {
    const cookie = req.cookies?.[`x_csrf_${suffix}`];
    const clientCachedCSRF = cookie ? req.unsignCookie(req.cookies?.[`x_csrf_${suffix}`]) : null;
    if (clientCachedCSRF?.valid) {
      const serverCachedCSRF: {
        token: string,
        expires: number
      } | null = await this.cache.get(`csrf_${suffix}:${clientCachedCSRF.value}`);
      if (serverCachedCSRF && serverCachedCSRF.expires - 180 > unixTimestamp()) return serverCachedCSRF.token;
    }

    const token = generateNanoId(128);
    const signature = generateNanoId(32);
    await this.cache.set(`csrf_${suffix}:${signature}`, {
      token,
      expires: unixTimestamp(CSRFService.EXPIRATION)
    }, CSRFService.EXPIRATION * 1000);

    //Set csrf signature to client cookie
    res.setCookie(`x_csrf_${suffix}`, signature, {
      expires: unixTimestamp(CSRFService.EXPIRATION, "DATE"),
      httpOnly: true,
      //secure: true,
      domain: ".faisal.gg",
      path: "/",
      signed: true
    });

    return token;
  }
}
