import { AwsClient } from 'aws4fetch';
import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

@Injectable()
export default class R2Service {
  public static readonly SUPPORTED_IMAGE_MIMETYPE = [
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];
  public static readonly MAX_SIZE = 5 * 1024 * 1024; // 5MB

  public static readonly PUBLIC_CDN_DOMAIN = 'https://cdn.faisal.gg';

  private readonly aws: AwsClient;

  private readonly logger: Logger = new Logger('R2Service');

  constructor(private readonly config: ConfigService) {
    this.aws = new AwsClient({
      accessKeyId: this.config.getOrThrow('CLOUDFLARE_R2_ACCESS_KEY'),
      secretAccessKey: this.config.getOrThrow('CLOUDFLARE_R2_SECRET'),
      region: 'auto',
      service: 's3',
    });
  }

  public get uri() {
    return `https://${this.config.getOrThrow(
      'CLOUDFLARE_ACCOUNT_ID',
    )}.r2.cloudflarestorage.com/${this.config.getOrThrow(
      'CLOUDFLARE_R2_BUCKET_NAME',
    )}`;
  }

  public async upload(object: Buffer, name: string) {
    const res = await this.aws.fetch(`${this.uri}/${name}`, {
      method: 'put',
      headers: {
        'Content-length': String(object.length),
      },
      body: object,
    });
    if (!res.ok) {
      const data = await res.text();
      this.logger.error('Something was wrong while uploading a file.', data);
      throw new ServiceUnavailableException();
    }
  }

  public async delete(name: string) {
    const res = await this.aws.fetch(`${this.uri}/${name}`, {
      method: 'delete',
    });
    if (!res.ok) {
      const data = await res.text();
      this.logger.error('Something was wrong while deleting a file.', data);
      throw new ServiceUnavailableException();
    }
  }
}
