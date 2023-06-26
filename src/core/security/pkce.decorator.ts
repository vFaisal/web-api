import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';

export const PkceCodeVerifier = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req: FastifyRequest = ctx.switchToHttp().getRequest();
    const signedCodeVerifier = req.cookies?.['pkce'];
    const unsignedCodeVerifier = signedCodeVerifier
      ? req.unsignCookie(signedCodeVerifier)
      : null;
    if (!unsignedCodeVerifier?.valid)
      throw new BadRequestException({
        code: 'pkce_required',
        message:
          'The PKCE code verifier is missing or has not been signed in the cookie. Please ensure that a valid code verifier is stored in the cookie.',
      });
    return unsignedCodeVerifier.value;
  },
);
