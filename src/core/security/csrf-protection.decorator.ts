import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import CSRFGuard from './csrf.guard';

export function CsrfProtection(suffix: string) {
  return applyDecorators(
    SetMetadata('csrfSuffix', suffix),
    UseGuards(CSRFGuard),
  );
}
