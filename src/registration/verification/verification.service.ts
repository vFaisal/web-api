import {BadRequestException, ConflictException, Injectable, ServiceUnavailableException} from '@nestjs/common';
import {PrismaService} from "../../prisma.service";
import {generateNanoId, unixTimestamp} from "../../utils";
import {randomInt} from "crypto";
import {hash, verify, argon2id} from "argon2";
import {PrismaClientKnownRequestError} from "@prisma/client/runtime";

@Injectable()
export class VerificationService {

    constructor(private prisma: PrismaService) {
    }


    public async createEmailVerification(email: string) {
        const existUser = await this.prisma.user.findUnique({
            where: {
                email: email
            },
            select: {
                id: true
            }
        })
        if (existUser) throw new ConflictException("Email is taken");
        const randomDigit = randomInt(100_000, 999_999)
        const verification = await this.prisma.oTPVerification.create({
            data: {
                phoneOrEmail: email,
                type: "EMAIL",
                intent: "REGISTRATION",
                hashCode: await hash(String(randomDigit), {
                    version: argon2id
                }),
                signature: generateNanoId(128),
                expires: new Date(Date.now() + 900_000), // 15 min
            },
            select: {
                signature: true
            }
        })
        console.log("Verification Code: ", randomDigit)
        return {
            signature: verification.signature
        }
    }

    public async verifyEmail({email, signature, code}: { email: string, signature: string, code: number }) {
        const verification = await this.prisma.oTPVerification.findUnique({
            where: {
                signature: signature
            },
            select: {
                id: true,
                expires: true,
                hashCode: true,
                verifiedAt: true,
                phoneOrEmail: true,
                type: true,
                attempts: true
            }
        });

        if (!verification || verification.verifiedAt || verification.type !== "EMAIL" || verification.phoneOrEmail !== email || Date.now() > verification.expires.getTime()) throw new BadRequestException("Verification token invalid.");

        if (verification.attempts >= 10) throw new BadRequestException("You have made too many attempts to verify this.")


        const codeVerification = await verify(verification.hashCode, String(code), {
            version: argon2id
        })


        await this.prisma.oTPVerification.update({
            data: {
                attempts: {
                    increment: 1
                },
                verifiedAt: codeVerification ? new Date() : undefined
            },
            where: {
                id: verification.id
            },
            select: {
                id: true
            }
        }).catch((err: PrismaClientKnownRequestError) => {
            if (err.code === "P2025") throw new BadRequestException("Verification token invalid.");
            throw new ServiceUnavailableException();
        })

        if (!codeVerification)
            throw new BadRequestException("Incorrect verification code.")
    }

}
