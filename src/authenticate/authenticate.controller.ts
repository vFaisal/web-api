import {Body, Controller, Get, HttpCode, HttpStatus} from '@nestjs/common';
import {AuthenticateService} from './authenticate.service';
import AuthenticateDto from "./dto/authenticate.dto";

@Controller({
    path: "authenticate",
    version: "1"
})
export class AuthenticateController {
    constructor(private readonly authenticateService: AuthenticateService) {
    }

    @Get()
    @HttpCode(HttpStatus.OK)
    public root(@Body() body: AuthenticateDto) {
        return this.authenticateService.authenticate(body.email, body.password);
    }
}
