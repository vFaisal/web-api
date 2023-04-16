import {AccountService} from "./account.service";
import {Controller, Get, HttpCode} from "@nestjs/common";

@Controller()
export class AccountController {
    constructor(private readonly accountService: AccountService) {
    }

    @Get("account/")
    @HttpCode(200)
    getAccount() {
        return this.accountService.getAccount();
    }
}
