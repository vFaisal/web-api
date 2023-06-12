export default class SessionEntity {

  private readonly ppi: string; // Primary Public Id (From AccountSession table)
  private readonly spi: string; // Secondary Public Id (From AccountSessionToken table)
  private readonly tkn: string; // This token for refresh token.
  private readonly act: { // Account
    id: string,
    pid: string // Public Id
  };
  private readonly cta: number; //createdTimestampAt

  constructor({ ppi, spi, tkn, act, cta }: {
    ppi: string,
    spi: string,
    tkn: string,
    act: {
      id: bigint,
      pid: string
    },
    cta: number
  }) {
    this.ppi = ppi;
    this.spi = spi;
    this.tkn = tkn;
    this.act = {
      id: String(act.id),
      pid: act.pid
    };
    this.cta = cta;
  }

  public isValid(): boolean {
    return !!this.ppi && !!this.spi && !!this.tkn && !!this.act?.id && !!this.act?.pid && !!this.cta;
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
      publicId: this.act.pid
    };
  }

  public getCreatedTimestampAt() {
    return this.cta;
  }

}
