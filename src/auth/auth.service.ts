import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../shared/providers/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { argon2id, verify } from 'argon2';
import {
  generateNanoId,
  SignificantRequestInformation,
  unixTimestamp,
} from '../shared/utils/util';
import { Account, SessionType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import SessionEntity from './entities/session.entity';
import { FastifyReply, FastifyRequest } from 'fastify';
import RedisService from '../shared/providers/redis.service';

@Injectable()
export class AuthService {
  private logger: Logger = new Logger('AuthService');
  public static readonly EXPIRATION = {
    ACCESS_TOKEN: 60 * 60, // 1h (Seconds)
    REFRESH_TOKEN: 60 * 60 * 24 * 14, // 14 Days (Seconds)
  };

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private kv: RedisService,
  ) {}

  public async authenticate(
    email: string,
    password: string,
    significantRequestInformation: SignificantRequestInformation,
  ) {
    const user = await this.prisma.account.findUnique({
      where: {
        email,
      },
    });
    if (!user)
      throw new BadRequestException('Email address not registered yet');

    const isVerifiedPassword = await verify(user.passwordHash, password, {
      version: argon2id,
    });
    if (!isVerifiedPassword)
      throw new BadRequestException('The credentials are invalid');

    return this.createCredentials(
      user,
      significantRequestInformation,
      SessionType.EMAIL,
    );
  }

  private async createJWT(accountPublicId: string) {
    const payload: AppJWTPayload = {
      spi: generateNanoId(), // Secondary public id (from AccountSessionTokens table)
      tkn: generateNanoId(32), //Token for refresh session (from AccountSessionTokens table)
      sub: accountPublicId,
    };
    return {
      accessToken: await this.jwt.signAsync(payload, {
        expiresIn: AuthService.EXPIRATION.ACCESS_TOKEN, // 1 hour
        algorithm: 'HS256',
        secret: this.config.getOrThrow('JWT_256_SECRET'),
      }),
      refreshToken: await this.jwt.signAsync(payload, {
        expiresIn: AuthService.EXPIRATION.REFRESH_TOKEN, // 2 week
        algorithm: 'HS512',
        secret: this.config.getOrThrow('JWT_512_SECRET'),
      }),
      payload: payload,
    };
  }

  private async addCredentialsToCache(
    jwtPayload: AppJWTPayload,
    primaryPublicId: string,
    accountId: bigint,
  ) {
    //Cache the access token for revocation (We add await if we want to use cache service like redis);
    await this.kv.setex(
      `session:${jwtPayload.spi}`,
      AuthService.EXPIRATION
        .ACCESS_TOKEN /* 1 hour same the access token expiration */,
      new SessionEntity({
        ppi: primaryPublicId,
        spi: jwtPayload.spi,
        tkn: jwtPayload.tkn,
        act: {
          id: accountId,
          pid: jwtPayload.sub,
        },
        cta: unixTimestamp(),
      }),
    );
  }

  public async createCredentials(
    account: Account,
    significantRequestInformation: SignificantRequestInformation,
    target: SessionType,
  ) {
    const jwt = await this.createJWT(account.publicId);

    const primarySessionId = generateNanoId();
    //Add refresh token to database;
    const session = await this.prisma.accountSession.create({
      data: {
        type: target,
        publicId: primarySessionId,
        accountId: account.id,
        tokens: {
          create: {
            publicId: jwt.payload.spi,
            token: jwt.payload.tkn,
            expires: unixTimestamp(
              AuthService.EXPIRATION.REFRESH_TOKEN,
              'DATE',
            ),
            visitor: {
              create: {
                publicId: generateNanoId(),
                ipAddress: significantRequestInformation.ipAddress,
                counterCode: significantRequestInformation.countryCode,
                city: significantRequestInformation.city,
                region: significantRequestInformation.region,
                isp: significantRequestInformation.isp,
                userAgent: significantRequestInformation.userAgent,
              },
            },
          },
        },
      },
      select: {
        accountId: true,
      },
    });

    await this.addCredentialsToCache(
      jwt.payload,
      primarySessionId,
      session.accountId,
    );

    return {
      accessToken: jwt.accessToken,
      refreshToken: jwt.refreshToken,
    };
  }

  public async refreshToken(
    token: string,
    significantRequestInformation: SignificantRequestInformation,
  ) {
    const refreshTokenPayload: AppJWTPayload = await this.jwtService
      .verifyAsync(token, {
        secret: this.config.getOrThrow('JWT_512_SECRET'),
        algorithms: ['HS512'],
      })
      .catch((err) => {
        this.logger.debug('Invalid refresh token', err);
        throw new BadRequestException('Invalid refresh token', err);
      });

    const tokenSession = await this.prisma.accountSessionTokens.findUnique({
      where: {
        token: refreshTokenPayload.tkn,
      },
      select: {
        session: {
          select: {
            publicId: true,
            id: true,
            revokedAt: true,
            account: {
              select: {
                id: true,
                publicId: true,
              },
            },
          },
        },
      },
    });

    if (!tokenSession || tokenSession.session.revokedAt)
      throw new BadRequestException(
        'Invalid refresh token',
        'Session not exist or has been revoked',
      );

    //Check if the refresh token has been used;
    const ref = await this.prisma.accountSessionTokens.findUnique({
      where: {
        ref: refreshTokenPayload.tkn,
      },
    });
    if (ref)
      throw new BadRequestException(
        'Invalid refresh token',
        'This refresh token has been used before.',
      );

    await this.kv.del(`session:${refreshTokenPayload.spi}`);

    const jwt = await this.createJWT(tokenSession.session.account.publicId);

    const visitor = await this.prisma.visitor.create({
      data: {
        publicId: generateNanoId(),
        ipAddress: significantRequestInformation.ipAddress,
        counterCode: significantRequestInformation.countryCode,
        city: significantRequestInformation.city,
        region: significantRequestInformation.region,
        isp: significantRequestInformation.isp,
        userAgent: significantRequestInformation.userAgent,
      },
    });
    const session = await this.prisma.accountSessionTokens.create({
      data: {
        publicId: jwt.payload.spi,
        sessionId: tokenSession.session.id,
        token: jwt.payload.tkn,
        expires: unixTimestamp(AuthService.EXPIRATION.REFRESH_TOKEN, 'DATE'),
        ref: refreshTokenPayload.tkn,
        visitorId: visitor.id,
      },
    });

    await this.addCredentialsToCache(
      jwt.payload,
      tokenSession.session.publicId,
      tokenSession.session.account.id,
    );

    return {
      accessToken: jwt.accessToken,
      refreshToken: jwt.refreshToken,
    };
  }

  public async revokeToken(session: SessionEntity) {
    await this.prisma.accountSessionTokens
      .update({
        where: {
          token: session.getToken(),
        },
        data: {
          session: {
            update: {
              revokedAt: new Date(),
            },
          },
        },
        select: {
          id: true,
        },
      })
      .catch(async (err) => {
        if (err.code === 'P2025') {
          await this.kv.del(`session:${session.getSecondaryPublicId()}`);
          throw new BadRequestException('Session not exist.');
        }
        this.logger.error(
          'Something was wrong while revoking token.',
          session,
          err,
        );
        throw new ServiceUnavailableException();
      });

    await this.kv.del(`session:${session.getSecondaryPublicId()}`);
  }
}

export interface AppJWTPayload {
  sub: string;
  spi: string;
  tkn: string;
}
