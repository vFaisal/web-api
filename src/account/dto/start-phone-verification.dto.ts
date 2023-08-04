import { IsEnum, Matches } from 'class-validator';
import { VerificationChannel } from '../../core/providers/twilio.service';
import Constants from '../../core/utils/constants';

export default class StartPhoneVerificationDto {
  //RegEx Matching for E.164
  @Matches(Constants.PHONE_VALIDATION_REGEX)
  phoneNumber: string;

  @IsEnum(VerificationChannel)
  channel: VerificationChannel;
}
