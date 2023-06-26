import { IsDefined, Matches } from 'class-validator';
import Constants from '../../core/utils/constants';

export default class RegistrationDto {
  @IsDefined()
  @Matches(Constants.EMAIL_VALIDATION_REGEX) // Email regex
  email: string;

  @Matches(/^[a-z0-9]{64}$/i)
  signature: string;
  @Matches(Constants.PASSWORD_VALIDATION_REGEX)
  password: string;
}
