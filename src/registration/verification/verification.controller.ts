import {Body, Controller, HttpCode, HttpStatus, Post, Put} from '@nestjs/common';
import {VerificationService} from './verification.service';
import CreateEmailVerificationDto from "./dto/create-email-verification.dto";
import VerifiyEmailDto from "./dto/verifiy-email.dto";

@Controller({
    path: "registration/verification",
    version: "1"
})
export class VerificationController {
    constructor(private readonly verificationService: VerificationService) {
    }


    @Post("/email")
    @HttpCode(HttpStatus.CREATED)
    root(@Body() body: CreateEmailVerificationDto) {
        return this.verificationService.createEmailVerification(body.email);
    }

    @Put("/email")
    @HttpCode(HttpStatus.NO_CONTENT)
    verifyEmail(@Body() body: VerifiyEmailDto) {
        return this.verificationService.verifyEmail(body);
    }
}
