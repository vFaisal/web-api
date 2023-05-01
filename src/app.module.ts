import {Global, Module} from '@nestjs/common';
import {AccountModule} from "./account/account.module";
import {AuthModule} from './auth/auth.module';
import {ConfigModule} from "@nestjs/config";
import {PrismaService} from "./prisma.service";
import { RegistrationModule } from './registration/registration.module';

@Global()
@Module({
    imports: [ConfigModule.forRoot({
        isGlobal: true
    }), AccountModule, AuthModule, RegistrationModule],
    controllers: [],
    providers: [PrismaService],
    exports: [PrismaService]

})
export class AppModule {
}
