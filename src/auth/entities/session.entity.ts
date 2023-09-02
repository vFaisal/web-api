import { AccessLevel } from '../../core/security/authorization.decorator';

export default class SessionEntity {
  private lvl: AccessLevel;
  private readonly ppi: string; // Primary Public Id (From AccountSession table)
  private readonly spi: string; // Secondary Public Id (From AccountSessionToken table)
  private readonly tkn: string; // This token for refresh token.
  private readonly act: {
    // Account
    id: string;
    pid: string; // Public Id
  };
  private readonly cta: number; //createdTimestampAt

  constructor(data: {
    ppi: string;
    spi: string;
    tkn: string;
    act: {
      id: bigint;
      pid: string;
    };
    cta: number;
    lvl: AccessLevel;
  }) {
    this.ppi = data?.ppi;
    this.spi = data?.spi;
    this.tkn = data?.tkn;
    this.act = {
      id: String(data?.act.id),
      pid: data?.act.pid,
    };
    this.cta = data?.cta;
    this.lvl = data?.lvl ?? AccessLevel.NONE;
  }

  public isValid(): boolean {
    return (
      !!this.ppi &&
      !!this.spi &&
      !!this.tkn &&
      !!this.act?.id &&
      !!this.act?.pid &&
      !!this.cta
    );
  }

  public getAccessLevel(): AccessLevel {
    return this.lvl ?? AccessLevel.NONE;
  }

  public setAccessLevel(level: AccessLevel) {
    this.lvl = level;
  }

  public getPrimaryPublicId(): string {
    return this.ppi;
  }

  public getSecondaryPublicId(): string {
    return this.spi;
  }

  public getToken(): string {
    return this.tkn;
  }

  public getAccount() {
    return {
      id: BigInt(this.act.id),
      publicId: this.act.pid,
    };
  }

  public getCreatedTimestampAt() {
    return this.cta;
  }
}
