import {Module} from '@nestjs/common';
import {AuthenticateService} from './authenticate.service';
import {AuthenticateController} from './authenticate.controller';

@Module({
    controllers: [AuthenticateController],
    providers: [AuthenticateService],
    exports: [AuthenticateService]
})
export class AuthenticateModule {
}
