import { Matches } from 'class-validator';

export default class MultiFactorLoginVerifyDto {
  @Matches(/^\d{6}$/)
  code: string;
}
