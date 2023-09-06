import { IsEnum } from 'class-validator';
import { VerificationChannel } from '../../../../core/providers/twilio.service';

export default class RequestMediumAccessLevelByPhoneDto {
  @IsEnum(VerificationChannel)
  channel: VerificationChannel;
}
