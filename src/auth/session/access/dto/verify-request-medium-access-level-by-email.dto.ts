import { Matches } from 'class-validator';

export default class VerifyRequestMediumAccessLevelByEmailDto {
  @Matches(/^\d{6}$/)
  code: string;
}
