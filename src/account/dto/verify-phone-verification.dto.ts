import { IsEnum, Matches } from 'class-validator';
import { VerificationChannel } from '../../core/providers/twilio.service';

export default class VerifyPhoneVerificationDto {
  //RegEx Matching for E.164
  @Matches(/^\+[1-9]\d{1,14}$/)
  phoneNumber: string;

  @Matches(/^[0-9]{6}$/)
  code: string;
}
