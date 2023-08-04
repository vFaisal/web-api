import { forwardRef, Module } from '@nestjs/common';
import { MultiFactorService } from './multi-factor.service';
import { MultiFactorController } from './multi-factor.controller';
import { AuthModule } from '../auth.module';

@Module({
  controllers: [MultiFactorController],
  providers: [MultiFactorService],
  imports: [forwardRef(() => AuthModule)],
})
export class MultiFactorModule {}
