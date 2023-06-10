import { unixTimestamp } from "../../utils/util";

export default class SessionEntity {

  public readonly primarySessionId: string | null;
  public readonly sessionId: string | null;
  public readonly accountId: bigint | null;
  public readonly accountPublicId: string | null;
  public readonly rid: string | null;
  public readonly createdTimestampAt: null | number;

  constructor(data: any) {
    this.primarySessionId = typeof data?.primarySessionId === "string" ? data.primarySessionId : null;
    this.sessionId = typeof data?.sessionId === "string" ? data.sessionId : null;
    this.rid = typeof data?.rid === "string" ? data.rid : null;
    this.accountPublicId = typeof data?.accountPublicId === "string" ? data.accountPublicId : null;
    this.accountId = typeof data?.accountId === "string" ? BigInt(data.accountId) : null;
    this.createdTimestampAt = typeof data?.createdTimestampAt === "number" ? data.createdTimestampAt : null;
  }

  public isValid(): boolean {
    return this.createdTimestampAt && !!this.sessionId && !!this.rid && !!this.accountPublicId && !!this.accountId && !!this.primarySessionId;
  }

}
