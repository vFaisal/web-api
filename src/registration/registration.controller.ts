import {Body, Controller, Get, HttpCode, HttpStatus, Param, Post} from '@nestjs/common';
import {RegistrationService} from './registration.service';
import RegistrationDto from "./dto/registration.dto";

@Controller({
    path: "registration",
    version: "1"
})
export class RegistrationController {
    constructor(private readonly registrationService: RegistrationService) {
    }


    @Post()
    @HttpCode(HttpStatus.CREATED)
    root(@Body() body: RegistrationDto) {
        return this.registrationService.createAccount(body)
    }
}
