import UpdateEmailDto from './update-email.dto';
import { Matches } from 'class-validator';

export default class VerifyUpdateEmailDto extends UpdateEmailDto {
  @Matches(/^\d{6}$/)
  code: string;
}
