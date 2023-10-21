import { Matches } from 'class-validator';
import TotpGlobalService from '../../../core/services/totp.global.service';

export default class VerifyTotpEntity {
  @Matches(new RegExp('^\\d{' + TotpGlobalService.DIGITS + '}$'))
  digit: string;
}
