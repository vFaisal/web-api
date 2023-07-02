import { forwardRef, Module } from '@nestjs/common';
import { MultiFactorService } from './multi-factor.service';
import { MfaController } from './multi-factor.controller';
import { AccountModule } from '../account.module';

@Module({
  controllers: [MfaController],
  providers: [MultiFactorService],
  imports: [forwardRef(() => AccountModule)],
})
export class MultiFactorModule {}
