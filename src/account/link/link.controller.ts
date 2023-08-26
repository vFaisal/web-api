import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Param,
  ParseEnumPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { LinkService } from './link.service';
import { AuthGuard } from '../../auth/auth.guard';
import { FastifyReply, FastifyRequest } from 'fastify';
import { CsrfProtection } from '../../core/security/csrf-protection.decorator';
import FederatedIdentityQueryDto from '../../auth/federated-identities/dto/federated-identity-query.dto';
import { PkceCodeVerifier } from '../../core/security/pkce.decorator';
import SessionEntity from '../../auth/entities/session.entity';
import { Provider } from '@prisma/client';

@Controller({
  path: 'account/link',
  version: '1',
})
export class LinkController {
  private readonly logger: Logger = new Logger('LinkController');
  constructor(private readonly linkService: LinkService) {}

  private getProviderFromPath(path: string): Provider {
    const split = path.split('/');
    const provider: Provider = Provider[split.at(4).toUpperCase()];
    if (!provider) {
      this.logger.error('path incorrect!', path);
      throw new InternalServerErrorException();
    }
    return provider;
  }
  @Get(['google', 'meta', 'microsoft', 'github' /*,"twitter"*/])
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.SEE_OTHER)
  public redirect(@Res() res: FastifyReply, @Req() req: FastifyRequest) {
    const provider = this.getProviderFromPath(req.routerPath);
    const session: SessionEntity = (req as any).session;
    return this.linkService.redirect(session, provider, req, res);
  }

  @Delete(['google', 'meta', 'microsoft', 'github' /*,"twitter"*/])
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public unlink(@Req() req: FastifyRequest) {
    const provider = this.getProviderFromPath(req.routerPath);
    const session: SessionEntity = (req as any).session;
    return this.linkService.unlink(session, provider);
  }

  @Get([
    'google/callback',
    'meta/callback',
    'microsoft/callback' /*,"twitter/callback"*/,
  ])
  @CsrfProtection('link')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public link(
    @Query() query: FederatedIdentityQueryDto,
    @PkceCodeVerifier() codeVerifier: string,
    @Req() req: FastifyRequest,
  ) {
    const provider = this.getProviderFromPath(req.routerPath);
    const session: SessionEntity = (req as any).session;
    return this.linkService.link(
      session,
      provider,
      query.state,
      query.code,
      codeVerifier,
    );
  }

  @Get('github/callback')
  @CsrfProtection('link')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public linkGithub(
    @Query() query: FederatedIdentityQueryDto,
    @Req() req: FastifyRequest,
  ) {
    const session: SessionEntity = (req as any).session;
    return this.linkService.link(
      session,
      Provider.GITHUB,
      query.state,
      query.code,
    );
  }
}
