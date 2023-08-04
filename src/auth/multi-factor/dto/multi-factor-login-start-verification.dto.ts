import { IsOptional, Matches, ValidateIf } from 'class-validator';
import Constants from '../../../core/utils/constants';

export default class MultiFactorLoginStartVerificationDto {
  @Matches(/^sms|voice|whatsapp|email|totp$/)
  method: AuthenticateMFAMethods;

  @Matches(Constants.PHONE_VALIDATION_REGEX)
  @ValidateIf((o) => ['voice', 'sms', 'whatsapp'].includes(o.method))
  phoneNumber: string;
}

export type AuthenticateMFAMethods =
  | 'sms'
  | 'voice'
  | 'whatsapp'
  | 'email'
  | 'totp';
