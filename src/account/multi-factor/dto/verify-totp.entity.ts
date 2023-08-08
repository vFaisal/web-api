import { Matches } from 'class-validator';
import TotpService from '../../../core/services/totp.service';

export default class VerifyTotpEntity {
  @Matches(new RegExp('^\\d{' + TotpService.DIGITS + '}$'))
  digit: string;
}
