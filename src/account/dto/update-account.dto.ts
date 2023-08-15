import { Matches, Validate } from 'class-validator';
import { CustomValidate } from '../../shared/decorators/CustomValidate.decorator';

export default class UpdateAccountDto {
  @Matches(/^[a-zA-Z\s]{2,32}$/)
  @CustomValidate(
    (text) => {
      console.log(text.trim().split(' ').length);
      return text.trim().split(' ').length <= 3;
    },
    {
      message: 'longer then 2 spaces not allowed',
    },
  )
  displayName: string;
}
