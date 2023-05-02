import {Global, Module} from '@nestjs/common';
import {AccountModule} from "./account/account.module";
import {AuthModule} from './auth/auth.module';
import {ConfigModule} from "@nestjs/config";
import {PrismaService} from "./prisma.service";
import { RegistrationModule } from './registration/registration.module';
import { AuthenticateModule } from './authenticate/authenticate.module';
import { AuthorizeModule } from './authorize/authorize.module';

@Global()
@Module({
    imports: [ConfigModule.forRoot({
        isGlobal: true
    }), AccountModule, AuthModule, RegistrationModule, AuthenticateModule, AuthorizeModule],
    controllers: [],
    providers: [PrismaService],
    exports: [PrismaService]

})
export class AppModule {
}
