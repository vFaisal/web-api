import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException, UnprocessableEntityException
} from "@nestjs/common";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";


@Injectable()
export default class RecaptchaGuard implements CanActivate {
  constructor(private config: ConfigService, private reflector: Reflector) {
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<string>("recaptchaAction", context.getHandler());
    if (!action) {
      Logger.error("action filed is required for Recaptcha");
      throw new ServiceUnavailableException();
    }

    const token = this.extractTokenFromHeader(context.switchToHttp().getRequest());
    if (!token) {
      throw new BadRequestException("We were unable to process your request due to an invalid or missing reCAPTCHA token.");
    }

    const res = await fetch(`https://recaptchaenterprise.googleapis.com/v1/projects/${this.config.get("GOOGLE_PROJECT_ID")}/assessments?key${this.config.get("GOOGLE_API_KEY")}`, {
      method: "POST",
      body: JSON.stringify({
        event: {
          token: token,
          siteKey: this.config.get("GOOGLE_SITE_KEY"),
          expectedAction: action
        }
      })
    });
    const data = await res.json();
    if (res.status !== 200 || !data.tokenProperties.valid || data.tokenProperties.action !== action) {
      Logger.debug(`Recaptcha status: ${res.status}`, data);
      throw new BadRequestException("We were unable to process your request due to an invalid or missing reCAPTCHA token.");
    }
    if (data.riskAnalysis.score >= 0.7) {
      return true;
    }
    throw new BadRequestException("The reCAPTCHA score for your request is too low");
  }

  private extractTokenFromHeader(request: Request): string | null {
    const token = request.headers["X-Recaptcha-Token"];
    return typeof token === "string" && token.length > 1000 ? token : null;
  }
}
