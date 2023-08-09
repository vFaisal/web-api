import { Matches } from 'class-validator';
import Constants from '../../core/utils/constants';

export default class PasswordRecoveryDto {
  @Matches(Constants.PASSWORD_VALIDATION_REGEX)
  password: string;
}
