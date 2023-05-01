import {Global, Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {PrismaClient, User} from "@prisma/client";


@Injectable()
export class PrismaService extends PrismaClient {
    constructor(private config: ConfigService) {
        super({
            log: ['query', 'info', 'warn', 'error'],
            errorFormat: "pretty",
            datasources: {
                db: {
                    url: config.get("DATABASE_DEVELOPMENT_URL")
                }
            }
        });
        (async () =>
                await this.$connect()
        )();
        this.$queryRaw`SET @@boost_cached_queries = true`
    }
}
