import { Matches } from 'class-validator';
import { MultiFactorService } from '../multi-factor.service';

export default class VerifyTotpEntity {
  @Matches(new RegExp('^\\d{' + MultiFactorService.DIGITS + '}$'))
  digit: string;
}
