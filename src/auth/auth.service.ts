import {
  BadRequestException,
  CACHE_MANAGER,
  CacheStore,
  Inject,
  Injectable, Logger, ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { JwtService } from "@nestjs/jwt";
import { argon2id, verify } from "argon2";
import { generateNanoId, SignificantRequestInformation, unixTimestamp } from "../utils/util";
import { Account, SessionType } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { Cache } from "cache-manager";
import SessionEntity from "./entities/session.entity";

@Injectable()
export class AuthService {

  private logger: Logger = new Logger("AuthService");
  private static readonly EXPIRATION = {
    ACCESS_TOKEN: 60 * 60, // 1h (Seconds)
    REFRESH_TOKEN: 60 * 60 * 24 * 14 // 14 Days (Seconds)
  };

  constructor(private jwtService: JwtService, private prisma: PrismaService, private jwt: JwtService, private config: ConfigService, @Inject(CACHE_MANAGER) private cache: Cache) {
  }

  public async authenticate(email: string, password: string, significantRequestInformation: SignificantRequestInformation) {
    const user = await this.prisma.account.findUnique({
      where: {
        email
      }
    });
    if (!user) throw new BadRequestException("Email address not registered yet");

    const isVerifiedPassword = await verify(user.passwordHash, password);
    if (!isVerifiedPassword) throw new BadRequestException("The credentials are invalid");

    return this.createCredentials(user, significantRequestInformation, SessionType.EMAIL);
  }


  private async createJWT(accountPublicId: string) {
    const payload: AppJWTPayload = {
      sid: generateNanoId(),
      rid: generateNanoId(32),
      sub: accountPublicId
    };
    return {
      accessToken: await this.jwt.signAsync(payload, {
        expiresIn: AuthService.EXPIRATION.ACCESS_TOKEN, // 1 hour
        algorithm: "HS256",
        secret: this.config.get("JWT_256_SECRET")
      }),
      refreshToken: await this.jwt.signAsync(payload, {
        expiresIn: AuthService.EXPIRATION.REFRESH_TOKEN, // 2 week
        algorithm: "HS512",
        secret: this.config.get("JWT_512_SECRET")
      }),
      payload: payload
    };
  }

  private async addCredentialsToCache(jwtPayload: AppJWTPayload) {
    //Cache the access token for revocation (We add await if we want to use cache service like redis);
    await this.cache.set(`session:${jwtPayload.sid}`, {
      accountPublicId: jwtPayload.sub,
      sessionId: jwtPayload.sid,
      rid: jwtPayload.rid,
      createdTimestampAt: unixTimestamp(),
      revokedTimestampAt: null
    }, AuthService.EXPIRATION.ACCESS_TOKEN * 1000 /* 1 hour same the access token expiration */);
  }


  public async createCredentials(account: Account, significantRequestInformation: SignificantRequestInformation, target: SessionType) {

    const jwt = await this.createJWT(account.publicId);

    //Add refresh token to database;
    await this.prisma.accountSession.create({
      data: {
        type: target,
        accountId: account.id,
        tokens: {
          create: {
            token: jwt.payload.rid,
            expires: unixTimestamp(AuthService.EXPIRATION.REFRESH_TOKEN, "DATE"),
            visitor: {
              create: {
                publicId: generateNanoId(),
                ipAddress: significantRequestInformation.ipAddress,
                counterCode: significantRequestInformation.countryCode,
                city: significantRequestInformation.city,
                region: significantRequestInformation.region,
                isp: significantRequestInformation.isp,
                userAgent: significantRequestInformation.userAgent
              }
            }
          }
        }
      }
    });

    await this.addCredentialsToCache(jwt.payload);

    return {
      accessToken: jwt.accessToken,
      refreshToken: jwt.refreshToken
    };
  }

  public async refreshToken(token: string, significantRequestInformation: SignificantRequestInformation) {

    const payload = await this.jwtService.verifyAsync(
      token,
      {
        secret: this.config.get("JWT_512_SECRET"),
        algorithms: ["HS512"]

      }
    ).catch((err) => {
      this.logger.debug("Invalid refresh token", err);
      throw new BadRequestException("Invalid refresh token", err);
    });

    const tokenSession = await this.prisma.accountSessionTokens.findUnique({
      where: {
        token: payload.rid
      },
      select: {
        session: {
          select: {
            id: true,
            revokedAt: true,
            account: true
          }
        }
      }
    });


    if (!tokenSession || tokenSession.session.revokedAt) throw new BadRequestException("Invalid refresh token", "Session not exist or has been revoked");

    //Check if the refresh token has been used;
    const ref = await this.prisma.accountSessionTokens.findUnique({
      where: {
        ref: payload.rid
      }
    });
    if (ref) throw new BadRequestException("Invalid refresh token", "This token has been used before");

    await this.cache.del(`session:${payload.sid}`);

    const jwt = await this.createJWT(tokenSession.session.account.publicId);

    const visitor = await this.prisma.visitor.create({
      data: {
        publicId: generateNanoId(),
        ipAddress: significantRequestInformation.ipAddress,
        counterCode: significantRequestInformation.countryCode,
        city: significantRequestInformation.city,
        region: significantRequestInformation.region,
        isp: significantRequestInformation.isp,
        userAgent: significantRequestInformation.userAgent
      }
    });
    await this.prisma.accountSessionTokens.create({
      data: {
        sessionId: tokenSession.session.id,
        token: jwt.payload.rid,
        expires: unixTimestamp(AuthService.EXPIRATION.REFRESH_TOKEN, "DATE"),
        ref: payload.rid,
        visitorId: visitor.id
      }
    });

    await this.addCredentialsToCache(jwt.payload);


    return {
      accessToken: jwt.accessToken,
      refreshToken: jwt.refreshToken
    };
  }

  public async revokeToken(session: SessionEntity) {

    await this.prisma.accountSessionTokens.update({
      where: {
        token: session.rid
      },
      data: {
        session: {
          update: {
            revokedAt: new Date()
          }
        }
      }, select: {
        id: true
      }
    }).catch(async (err) => {
      if (err.code === "P2025") {
        await this.cache.del(`session:${session.sessionId}`);
        throw new BadRequestException("Session not exist.");
      }
      console.log(err);
      throw new ServiceUnavailableException();
    });

    await this.cache.del(`session:${session.sessionId}`);


  }

}


interface AppJWTPayload {
  sub: string,
  sid: string,
  rid: string
}
