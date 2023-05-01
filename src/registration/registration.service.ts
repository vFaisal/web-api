import {BadRequestException, ConflictException, Injectable, InternalServerErrorException} from '@nestjs/common';
import {PrismaService} from "../prisma.service";
import RegistrationDto from "./dto/registration.dto";
import {generateNanoId, unixTimestamp} from "../utils";
import {argon2id, hash} from "argon2";
import {PrismaClientKnownRequestError} from "@prisma/client/runtime";

@Injectable()
export class RegistrationService {

    constructor(private readonly prisma: PrismaService) {
    }

    public async createAccount(params: RegistrationDto) {
        const verification = await this.prisma.oTPVerification.findUnique({
            where: {
                signature: params.signature
            }
        });
        if (!verification || verification.intent !== "REGISTRATION" || verification.phoneOrEmail !== params.email || !verification.verifiedAt) throw new BadRequestException("Invalid signature");
        if (verification.verifiedAt.getTime() <= unixTimestamp() - 3600) new BadRequestException("Signature has expired"); // 1 hour

        const user = await this.prisma.user.create({
            data: {
                email: verification.phoneOrEmail,
                verificationId: verification.id,
                passwordHash: await hash(params.password, {
                    version: argon2id
                }),
                publicId: generateNanoId()
            }
        }).catch((err: PrismaClientKnownRequestError) => {
            if (err.code == "P2002") throw new ConflictException();
            throw new InternalServerErrorException();
        });
        return {
            id: user.publicId,
            email: user.email,
            displayName: user.displayName,
            createdAt: user.createdAt,
        }
    }
}
