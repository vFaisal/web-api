import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { GoogleService } from './google.service';
import FederatedIdentityQueryDto from '../dto/federated-identity-query.dto';
import CSRFService from '../../../core/security/csrf.service';
import { significantRequestInformation } from '../../../core/utils/util';
import { CsrfProtection } from '../../../core/security/csrf-protection.decorator';
import { PkceCodeVerifier } from '../../../core/security/pkce.decorator';
import PKCEService from '../../../core/security/pkce.service';

@Controller({
  path: '/auth/federated-identities/google',
  version: '1',
})
export class GoogleController {
  constructor(
    private readonly googleService: GoogleService,
    private readonly csrfService: CSRFService,
    private readonly pkceService: PKCEService,
  ) {}

  @Get('')
  @HttpCode(HttpStatus.SEE_OTHER)
  async root(@Res() res, @Req() req) {
    const token = await this.csrfService.create(req, res, 'auth');
    res.redirect(
      this.googleService.redirectAuthEndpointUrl(
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
    return this.googleService.authenticate(
      query.code,
      codeVerifier,
      significantRequestInformation(req),
    );
  }
}
