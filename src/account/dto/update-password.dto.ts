import { Matches } from 'class-validator';
import Constants from '../../core/utils/constants';

export default class UpdatePasswordDto {
  @Matches(Constants.PASSWORD_VALIDATION_REGEX)
  currentPassword: string;
  @Matches(Constants.PASSWORD_VALIDATION_REGEX)
  newPassword: string;
}
