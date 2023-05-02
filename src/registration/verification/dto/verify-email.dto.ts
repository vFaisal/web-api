import {Matches} from "class-validator";
import Constants from "../../../constants";


export default class VerifyEmailDto {
    @Matches(Constants.EMAIL_VALIDATION_REGEX)
    email: string
    
    @Matches(/^[a-z0-9]{128}$/i)
    signature: string

    @Matches(/^\d{6}$/)
    code: number
}
