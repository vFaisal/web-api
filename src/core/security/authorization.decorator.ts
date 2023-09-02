import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';

export enum AccessLevel {
  NONE,
  MEDIUM = 2,
  HIGH = 3,
}
export function Authorization(level: AccessLevel) {
  return applyDecorators(SetMetadata('level', level), UseGuards(AuthGuard));
}
