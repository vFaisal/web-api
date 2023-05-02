import {BadRequestException, Injectable} from '@nestjs/common';
import {PrismaService} from "../prisma.service";
import {JwtService} from "@nestjs/jwt";
import {argon2id, verify} from "argon2";
import {generateNanoId, unixTimestamp} from "../utils";
import {User} from "@prisma/client";
import {ConfigService} from "@nestjs/config";

@Injectable()
export class AuthenticateService {
    constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService) {
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
            sub: user.publicId,
        }, {
            expiresIn: 60 * 60 * 6, // 6 hour
            secret: this.config.get("JWT_SECRET")
        })
        const refreshToken = await this.jwt.signAsync({
            sub: user.publicId,
        }, {
            expiresIn: 60 * 60 * 24 * 7, // 1 week
            secret: this.config.get("JWT_SECRET")
        })
        await this.prisma.userSession.create({
            data: {
                publicId: generateNanoId(),
                accessToken,
                refreshToken,
                expires: new Date(Date.now() + 60 * 60 * 6 * 1000),
                userId: user.id,
            }
        });
        return {
            accessToken,
            refreshToken
        }
    }

}
