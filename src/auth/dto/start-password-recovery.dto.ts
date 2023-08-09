import { Matches } from 'class-validator';
import Constants from '../../core/utils/constants';

export default class StartPasswordRecoveryDto {
  @Matches(Constants.EMAIL_VALIDATION_REGEX)
  email: string;
}
