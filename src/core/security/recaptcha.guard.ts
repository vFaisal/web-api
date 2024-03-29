import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { retry } from 'rxjs';

@Injectable()
export default class RecaptchaGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.getOrThrow('NODE_ENV') !== 'production') return true;

    const action = this.reflector.get<string>(
      'recaptchaAction',
      context.getHandler(),
    );

    const token = this.extractTokenFromHeader(
      context.switchToHttp().getRequest(),
    );
    if (!token) {
      throw new BadRequestException(
        'We were unable to process your request due to an invalid or missing reCAPTCHA token.',
      );
    }

    const res = await fetch(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${this.config.getOrThrow(
        'GOOGLE_PROJECT_ID',
      )}/assessments?key=${this.config.getOrThrow('GOOGLE_API_KEY')}`,
      {
        method: 'POST',
        body: JSON.stringify({
          event: {
            token: token,
            siteKey: this.config.getOrThrow('GOOGLE_SITE_KEY'),
            expectedAction: action,
          },
        }),
      },
    );
    const data = await res.json();
    if (
      res.status !== 200 ||
      !data.tokenProperties.valid ||
      data.tokenProperties.action !== action
    ) {
      Logger.debug(`Recaptcha status: ${res.status}`, data);
      throw new BadRequestException(
        'We were unable to process your request due to an invalid or missing reCAPTCHA token.',
      );
    }
    if (data.riskAnalysis.score >= 0.7) {
      return true;
    }
    throw new BadRequestException(
      'The reCAPTCHA score for your request is too low',
    );
  }

  private extractTokenFromHeader(request: FastifyRequest): string | null {
    const token = request.headers['X-Recaptcha-Token'];
    return typeof token === 'string' && token.length > 1000 ? token : null;
  }
}
