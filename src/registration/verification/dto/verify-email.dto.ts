import { Matches } from 'class-validator';
import Constants from '../../../core/utils/constants';

export default class VerifyEmailDto {
  @Matches(Constants.EMAIL_VALIDATION_REGEX)
  email: string;

  @Matches(/^\d{6}$/)
  code: string;
}
