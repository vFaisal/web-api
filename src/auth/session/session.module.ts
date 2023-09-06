import { Module } from '@nestjs/common';
import { SessionServiceB } from './session.service';
import { SessionController } from './session.controller';
import { AccessModule } from './access/access.module';

@Module({
  controllers: [SessionController],
  providers: [SessionServiceB],
  imports: [AccessModule],
})
export class SessionModule {}
