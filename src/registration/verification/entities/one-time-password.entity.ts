import { unixTimestamp } from '../../../core/utils/util';
import { ServiceUnavailableException } from '@nestjs/common';

export default class OneTimePasswordEntity<T extends 'CREATION' | 'GET'> {
  public readonly phoneOrEmail: string;
  public readonly target: 'EMAIL' | 'PHONE';
  public readonly signature: string;
  public readonly hashCode: string;
  public readonly intent: 'REGISTRATION';
  public attempts: number;
  public readonly createdTimestampAt: number;

  constructor(
    data: T extends 'CREATION'
      ? {
          phoneOrEmail: string;
          target: 'EMAIL' | 'PHONE';
          signature: string;
          hashCode: string;
          intent: 'REGISTRATION';
          attempts: number;
          createdTimestampAt: number;
        }
      : any,
  ) {
    this.phoneOrEmail = data?.phoneOrEmail;
    this.signature = data?.signature;
    this.hashCode = data?.hashCode;
    this.intent = data?.intent;
    this.target = data?.target;
    this.attempts = data?.attempts;
    this.createdTimestampAt = data?.createdTimestampAt;
  }

  public isValid() {
    return (
      typeof this.phoneOrEmail === 'string' &&
      typeof this.target === 'string' &&
      typeof this.signature === 'string' &&
      typeof this.hashCode === 'string' &&
      typeof this.intent === 'string' &&
      typeof this.attempts === 'number' &&
      typeof this.createdTimestampAt === 'number'
    );
  }
}
