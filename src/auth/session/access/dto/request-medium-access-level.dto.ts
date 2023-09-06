import { Matches, Validate } from 'class-validator';
import Constants from '../../../../core/utils/constants';

export default class RequestMediumAccessLevelDto {
  @Matches(Constants.PASSWORD_VALIDATION_REGEX)
  password: string;
}
