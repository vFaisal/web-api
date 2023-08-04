import { IsEnum, Matches } from 'class-validator';
import { VerificationChannel } from '../../core/providers/twilio.service';
import Constants from '../../core/utils/constants';

export default class VerifyPhoneVerificationDto {
  //RegEx Matching for E.164
  @Matches(Constants.PHONE_VALIDATION_REGEX)
  phoneNumber: string;

  @Matches(/^[0-9]{6}$/)
  code: string;
}
