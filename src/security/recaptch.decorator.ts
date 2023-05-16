import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import RecaptchaGuard from "./recaptcha.guard";


export function Recaptcha(action: string) {
  return applyDecorators(
    SetMetadata("recaptchaAction", action),
    UseGuards(RecaptchaGuard)
  );
}
