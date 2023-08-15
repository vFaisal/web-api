import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

@Injectable()
export default class OpenaiService {
  private static readonly API_BASE = 'https://api.openai.com/v1';
  private readonly logger: Logger = new Logger('OpenaiService');

  constructor(private readonly config: ConfigService) {}

  private async request(path: string, method: string, payload?: any) {
    const res = await fetch(OpenaiService.API_BASE + path, {
      method: method,
      headers: {
        authorization: 'Bearer ' + this.config.getOrThrow('OPENAI_API_KEY'),
        'OpenAI-Organization': this.config.getOrThrow('OPENAI_ORGANIZATION_ID'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.status === 429) {
      this.logger.warn('Openai Rate-limit reached', data);
      throw new ServiceUnavailableException({
        code: 'thirdparty_service_limitation',
        message:
          'The requested service is currently unavailable due to limitations imposed by a third-party service. Please try again later.',
      });
    }
    if (res.status > 299) {
      this.logger.error(
        'Unexpected response from Openai API.',
        res.status,
        data,
      );
      throw new InternalServerErrorException();
    }

    return data;
  }

  public async moderation(input: string): Promise<ModerationResponse> {
    return (
      await this.request('/moderations', 'POST', {
        input,
        model: 'text-moderation-latest',
      })
    ).results[0];
  }
}

interface ModerationCategories<T> {
  sexual: T;
  hate: T;
  harassment: T;
  'self-harm': T;
  'sexual/minors': T;
  'hate/threatening': T;
  'violence/graphic': T;
  'self-harm/intent': T;
  'self-harm/instructions': T;
  'harassment/threatening': T;
  violence: T;
}

interface ModerationResponse {
  flagged: boolean;
  categories: ModerationCategories<boolean>;
  category_scores: ModerationCategories<number>;
}
