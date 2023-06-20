import { forwardRef, Module } from "@nestjs/common";
import { TwoFactorService } from "./two-factor.service";
import { TwoFactorController } from "./two-factor.controller";
import { AccountModule } from "../account.module";

@Module({
  controllers: [TwoFactorController],
  providers: [TwoFactorService],
  imports: [forwardRef(() => AccountModule)]
})
export class TwoFactorModule {
}
