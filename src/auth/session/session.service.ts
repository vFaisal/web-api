import { Injectable } from '@nestjs/common';
import SessionEntity from '../entities/session.entity';
import SessionGlobalService from '../../core/services/session.global.service';
@Injectable()
export class SessionServiceB {
  constructor(private readonly sessionService: SessionGlobalService) {}

  public async revokeCurrentSession(session: SessionEntity) {
    await this.sessionService.revoke(
      session.getPrimaryPublicId(),
      session.getAccount().id,
      session.getSecondaryPublicId(),
    );
  }
}
