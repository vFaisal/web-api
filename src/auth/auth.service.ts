import { BadRequestException, CACHE_MANAGER, CacheStore, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { JwtService } from "@nestjs/jwt";
import { argon2id, verify } from "argon2";
import { generateNanoId, unixTimestamp } from "../utils/util";
import { User } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { Cache } from "cache-manager";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService, @Inject(CACHE_MANAGER) private cache: Cache) {
  }

  public async authenticate(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email
      }
    });
    if (!user) throw new BadRequestException("Email address not registered yet");

    const isVerifiedPassword = await verify(user.passwordHash, password);
    if (!isVerifiedPassword) throw new BadRequestException("The credentials are invalid");

    return this.createSession(user);
  }


  public async createSession(user: User) {
    const accessToken = await this.jwt.signAsync({
      sub: user.publicId
    }, {
      expiresIn: "1h", // 1 hour
      algorithm: "HS256",
      secret: this.config.get("JWT_256_SECRET")
    });
    const refreshToken = await this.jwt.signAsync({
      sub: user.publicId
    }, {
      expiresIn: "7d", // 1 week
      algorithm: "HS512",
      secret: this.config.get("JWT_512_SECRET")
    });

    //Cache the access token for revocation (We add await if we want to use cache service like redis);
    await this.cache.set(`session:${accessToken}`, {
      accountPublicId: user.publicId,
      createdTimestampAt: unixTimestamp(),
      revokedTimestampAt: null
    }, 3600 * 1000 /* 1 hour same the access token expiration */);

    //Add refresh token to database;
    await this.prisma.userSession.create({
      data: {
        publicId: generateNanoId(),
        accessToken,
        refreshToken,
        expires: new Date(Date.now() + 60 * 60 * 6 * 1000),
        userId: user.id
      }
    });
    return {
      accessToken,
      refreshToken
    };
  }

}
