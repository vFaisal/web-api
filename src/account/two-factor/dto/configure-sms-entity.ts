import { Matches } from 'class-validator';
import { TwoFactorService } from '../two-factor.service';

export default class ConfigureSmsEntity {
  @Matches(/^\+[1-9]\d{1,14}$/)
  phone: string;
}
