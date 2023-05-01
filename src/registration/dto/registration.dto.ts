import {IsDefined, Matches} from "class-validator";

export default class RegistrationDto {
    @IsDefined()
    @Matches(/^[\w\.-]+@[\w\.-]+\.\w{2,4}$/)
    email: string

    @Matches(/^[a-z0-9]{128}$/i)
    signature: string
    @Matches(/^.{6,}$/)
    password: string
}
