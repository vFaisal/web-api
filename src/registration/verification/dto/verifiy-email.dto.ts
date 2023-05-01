import {Matches} from "class-validator";


export default class VerifiyEmailDto {
    @Matches(/^[a-z0-9]{128}$/i)
    signature: string

    @Matches(/^\d{6}$/)
    code: number
}
