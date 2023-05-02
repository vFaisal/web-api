import {Matches} from "class-validator";
import Constants from "../../constants";

export default class AuthenticateDto {
    @Matches(Constants.EMAIL_VALIDATION_REGEX)
    email: string
    @Matches(Constants.PASSWORD_VALIDATION_REGEX)
    password: string
}
