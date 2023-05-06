export default class SessionEntity {

  public readonly accountPublicId: string | null;
  public readonly createdTimestampAt: null | number;
  public readonly revokedTimestampAt: null | number;

  constructor(data: any) {
    this.accountPublicId = typeof data?.accountPublicId === "string" ? data.accountPublicId : null;
    this.createdTimestampAt = typeof data?.createdTimestampAt === "number" ? data.createdTimestampAt : null;
    this.revokedTimestampAt = typeof data?.revokedTimestampAt === "number" ? data.revokedTimestampAt : null;
  }

  public isValid(): boolean {
    return this.createdTimestampAt && !this.revokedTimestampAt && !!this.accountPublicId;
  }
}
