import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { FacebookService } from './facebook.service';
import PKCEService from '../../../security/pkce.service';
import { CsrfProtection } from '../../../security/csrf-protection.decorator';
import CSRFService from '../../../security/csrf.service';
import { PkceCodeVerifier } from '../../../security/pkce.decorator';
import { significantRequestInformation } from '../../../utils/util';
import FederatedIdentityQueryDto from '../dto/federated-identity-query.dto';

@Controller({
  path: '/auth/federated-identities/facebook',
  version: '1',
})
export class FacebookController {
  constructor(
    private readonly facebookService: FacebookService,
    private readonly csrfService: CSRFService,
    private readonly pkceService: PKCEService,
  ) {}

  @Get('')
  @HttpCode(HttpStatus.SEE_OTHER)
  async root(@Res() res, @Req() req) {
    const token = await this.csrfService.create(req, res, 'auth');
    res.redirect(
      this.facebookService.redirectAuthEndpointUrl(
        token,
        this.pkceService.enforcePKCE(res, req),
      ),
    );
  }

  @Get('callback')
  @HttpCode(HttpStatus.OK)
  @CsrfProtection('auth')
  callback(
    @Query() query: FederatedIdentityQueryDto,
    @PkceCodeVerifier() codeVerifier: string,
    @Req() req,
  ) {
    return this.facebookService.authenticate(
      query.code,
      codeVerifier,
      significantRequestInformation(req),
    );
  }
}
