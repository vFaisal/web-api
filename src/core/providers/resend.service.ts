import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

@Injectable()
export default class ResendService {
  private static readonly API_BASE = 'https://api.resend.com';

  private readonly logger: Logger = new Logger('ResendService');

  constructor(private readonly config: ConfigService) {}

  public async sendEmail(
    to: string,
    subject: string,
    content: { text: string } | { html: string },
  ) {
    const res = await fetch(ResendService.API_BASE + '/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.config.getOrThrow('RESEND_API_KEY'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...content,
        from: 'no-reply@faisal.gg',
        to,
        subject,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      this.logger.error(
        `Unable to send email to ${to} status: ${res.status}`,
        data,
      );
      throw new ServiceUnavailableException();
    }
  }
}
