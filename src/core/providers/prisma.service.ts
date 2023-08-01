import {
  Global,
  INestApplication,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private config: ConfigService) {
    super({
      log: ['query', 'info', 'warn', 'error'],
      errorFormat: 'pretty',
      datasources: {
        db: {
          url: config.getOrThrow('DATABASE_URL'),
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.$queryRaw`SET @@boost_cached_queries = true;`;
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
