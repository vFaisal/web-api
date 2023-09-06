import { Injectable } from '@nestjs/common';
import SessionEntity from '../entities/session.entity';
import SessionService from '../../core/services/session.service';
@Injectable()
export class SessionServiceB {
  constructor(private readonly sessionService: SessionService) {}

  public async revokeCurrentSession(session: SessionEntity) {
    await this.sessionService.revoke(
      session.getPrimaryPublicId(),
      session.getAccount().id,
      session.getSecondaryPublicId(),
    );
  }
}
