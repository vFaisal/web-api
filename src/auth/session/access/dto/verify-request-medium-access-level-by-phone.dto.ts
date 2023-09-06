import { Matches } from 'class-validator';

export default class VerifyRequestMediumAccessLevelByPhoneDto {
  @Matches(/^\d{6}$/)
  code: string;
}
