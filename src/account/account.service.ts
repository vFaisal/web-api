import {
  Injectable, Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException
} from "@nestjs/common";
import { PrismaService } from "../providers/prisma.service";
import { AccountEntity } from "./entities/account.entity";
import { MultipartFile } from "@fastify/multipart";
import R2Service from "../providers/r2.service";
import { nanoid } from "nanoid";
import { generateNanoId } from "../utils/util";
import SessionEntity from "../auth/entities/session.entity";

@Injectable()
export class AccountService {

  private logger: Logger = new Logger("AccountService");

  constructor(private prisma: PrismaService, private readonly r2: R2Service) {
  }

  public getAccount(id: bigint) {

  }

  public async getSafeAccountData(id: bigint) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: id
      }
    });
    return new AccountEntity(account);
  }

  public async uploadPhoto(file: MultipartFile, session: SessionEntity) {
    if (!R2Service.SUPPORTED_IMAGE_MIMETYPE.includes(file.mimetype)) throw new UnsupportedMediaTypeException({
      code: "unsupported_file_type",
      message: "Unsupported file type."
    });

    const bufferFile = await file.toBuffer();

    if (bufferFile.length > R2Service.MAX_SIZE) throw new PayloadTooLargeException({
      code: "max_size_exceeded",
      message: `File size exceeds the maximum supported limit of ${R2Service.MAX_SIZE / 1024 / 1024}MB.`
    });

    const generatedImageId = generateNanoId(32);

    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id
      },
      select: {
        photoHash: true
      }
    });

    if (account.photoHash) await this.r2.delete(account.photoHash);

    await this.r2.upload(bufferFile, generatedImageId);

    await this.prisma.account.updateMany({
      data: {
        photoHash: generatedImageId
      },
      where: {
        id: session.getAccount().id
      }
    });

    return {
      url: R2Service.PUBLIC_CDN_DOMAIN + "/" + generatedImageId
    };
  }

  public async deletePhoto(session: SessionEntity) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: session.getAccount().id
      },
      select: {
        photoHash: true
      }
    });
    if (account.photoHash) {
      await this.r2.delete(account.photoHash);
      await this.prisma.account.updateMany({
        data: {
          photoHash: null
        },
        where: {
          id: session.getAccount().id
        }
      });
    }
  }

}
