import { Matches } from 'class-validator';
import { TwoFactorService } from '../two-factor.service';

export default class VerifyTotpEntity {
  @Matches(new RegExp('^\\d{' + TwoFactorService.DIGITS + '}$'))
  digit: string;
}
