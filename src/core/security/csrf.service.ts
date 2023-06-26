import { FastifyReply, FastifyRequest } from 'fastify';
import { unixTimestamp } from '../utils/util';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import Tokens from '@fastify/csrf';

@Injectable()
export default class CSRFService {
  public static readonly EXPIRATION = 60 * 15;

  public readonly dep = new Tokens({
    validity: CSRFService.EXPIRATION * 1000,
    algorithm: 'sha512',
    userInfo: false,
    secretLength: 24,
    saltLength: 12,
  });

  constructor(private config: ConfigService) {}

  public async create(
    req: FastifyRequest,
    res: FastifyReply,
    suffix: string,
  ): Promise<string> {
    const cookie = req.cookies?.[`x_csrf_${suffix}`];
    const secretCsrfCookie = cookie ? req.cookies?.[`x_csrf_${suffix}`] : null;
    const tokenCsrfCookie = cookie ? req.cookies?.[`x_xsrf_${suffix}`] : null;

    if (
      this.validateSecretLength(secretCsrfCookie) &&
      this.validateTokenLength(tokenCsrfCookie) &&
      this.dep.verify(secretCsrfCookie, tokenCsrfCookie)
    )
      return tokenCsrfCookie;

    const secret = this.dep.secretSync();
    const token = this.dep.create(secret);

    const cookieOptions = {
      expires: unixTimestamp(CSRFService.EXPIRATION, 'DATE'),
      httpOnly: true,
      secure: this.config.getOrThrow('NODE_ENV') === 'production',
      domain: '.faisal.gg',
      path: '/',
      signed: false,
    };

    //Set csrf signature to client cookie
    res.setCookie(`x_csrf_${suffix}`, secret, cookieOptions);
    res.setCookie(`x_xsrf_${suffix}`, token, cookieOptions);

    return token;
  }

  public validateSecretLength(secret: any) {
    return typeof secret === 'string' && secret.length > 30;
  }

  public validateTokenLength(token: any) {
    return typeof token === 'string' && token.length > 100;
  }
}
