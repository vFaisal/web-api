import {IsDefined, Matches} from "class-validator";

export default class CreateEmailVerificationDto {
    @IsDefined()
    @Matches(/^[\w\.-]+@[\w\.-]+\.\w{2,4}$/)
    email: string

}
