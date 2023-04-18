import {Global, Module} from '@nestjs/common';
import {AccountModule} from "./account/account.module";
import {AuthModule} from './auth/auth.module';
import {ConfigModule} from "@nestjs/config";
import {PrismaService} from "./prisma.service";

@Global()
@Module({
    imports: [ConfigModule.forRoot({
        isGlobal: true
    }), AccountModule, AuthModule],
    controllers: [],
    providers: [PrismaService],
    exports: [PrismaService]

})
export class AppModule {
}
