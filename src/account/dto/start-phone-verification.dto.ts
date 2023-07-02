import { IsEnum, Matches } from 'class-validator';
import { VerificationChannel } from '../../core/providers/twilio.service';

export default class StartPhoneVerificationDto {
  //RegEx Matching for E.164
  @Matches(/^\+[1-9]\d{1,14}$/)
  phoneNumber: string;

  @IsEnum(VerificationChannel)
  channel: VerificationChannel;
}
