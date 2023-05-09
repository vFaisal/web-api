import { unixTimestamp } from "../../utils/util";

export default class SessionEntity {

  public readonly sessionId: string | null;
  public readonly accountPublicId: string | null;
  public readonly rid: string | null;
  public readonly createdTimestampAt: null | number;

  constructor(data: any) {
    this.sessionId = typeof data?.sessionId === "string" ? data.sessionId : null;
    this.rid = typeof data?.rid === "string" ? data.rid : null;
    this.accountPublicId = typeof data?.accountPublicId === "string" ? data.accountPublicId : null;
    this.createdTimestampAt = typeof data?.createdTimestampAt === "number" ? data.createdTimestampAt : null;
  }

  public isValid(): boolean {
    return this.createdTimestampAt && !!this.accountPublicId && !!this.accountPublicId && !!this.accountPublicId;
  }

}
