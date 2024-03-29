import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { GithubService } from './github.service';
import { CsrfProtection } from '../../../core/security/csrf-protection.decorator';
import FederatedIdentityQueryDto from '../dto/federated-identity-query.dto';
import { significantRequestInformation } from '../../../core/utils/util';
import CSRFService from '../../../core/security/csrf.service';

@Controller({
  path: '/auth/federated-identities/github',
  version: '1',
})
export class GithubController {
  constructor(
    private readonly githubService: GithubService,
    private readonly csrfService: CSRFService,
  ) {}

  @Get('')
  @HttpCode(HttpStatus.SEE_OTHER)
  async root(@Res() res, @Req() req) {
    const token = await this.csrfService.create(req, res, 'auth');
    res.redirect(this.githubService.redirectAuthEndpointUrl(token));
  }

  @Get('callback')
  @HttpCode(HttpStatus.OK)
  @CsrfProtection('auth')
  callback(@Query() query: FederatedIdentityQueryDto, @Req() req) {
    return this.githubService.authenticate(
      query.code,
      significantRequestInformation(req),
    );
  }
}
