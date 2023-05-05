import {SetMetadata} from '@nestjs/common';

export const RecaptchaAction = (action: string) => SetMetadata('recaptchaAction', action);
