import { Matches } from 'class-validator';

export default class RequestMediumAccessLevelByTotpDto {
  @Matches(/^\d{6}$/)
  code: string;
}
