import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { MicrosoftService } from './microsoft.service';
import { CsrfProtection } from '../../../core/security/csrf-protection.decorator';
import FederatedIdentityQueryDto from '../dto/federated-identity-query.dto';
import { significantRequestInformation } from '../../../core/utils/util';
import CSRFService from '../../../core/security/csrf.service';
import PKCEService from '../../../core/security/pkce.service';
import { PkceCodeVerifier } from '../../../core/security/pkce.decorator';

@Controller({
  path: '/auth/federated-identities/microsoft',
  version: '1',
})
export class MicrosoftController {
  constructor(
    private readonly microsoftService: MicrosoftService,
    private readonly csrfService: CSRFService,
    private readonly pkceService: PKCEService,
  ) {}

  @Get('')
  @HttpCode(HttpStatus.SEE_OTHER)
  async root(@Res() res, @Req() req) {
    const token = await this.csrfService.create(req, res, 'auth');
    res.redirect(
      this.microsoftService.redirectAuthEndpointUrl(
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
    return this.microsoftService.authenticate(
      query.code,
      codeVerifier,
      significantRequestInformation(req),
    );
  }
}
