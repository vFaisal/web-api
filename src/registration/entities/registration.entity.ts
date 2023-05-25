import { Provider } from "@prisma/client";

export default class RegistrationEntity<T extends "CREATION" | "GET"> {
  public readonly phoneOrEmail: string;
  public readonly target: "EMAIL" | "PHONE";
  public readonly signature: string;
  public readonly federatedIdentity: Provider;
  public readonly createdTimestampAt: number;

  constructor(data: T extends "CREATION" ? {
    phoneOrEmail: string;
    target: "EMAIL" | "PHONE";
    signature: string;
    createdTimestampAt: number;
    federatedIdentity?: Provider;
  } : any) {
    this.phoneOrEmail = data?.phoneOrEmail;
    this.target = data?.target;
    this.signature = data?.signature;
    this.createdTimestampAt = data?.createdTimestampAt;
    this.federatedIdentity = data?.federatedIdentity ?? null;
  }

  public isValid() {
    return typeof this.phoneOrEmail === "string" && typeof this.target === "string" && typeof this.signature === "string" && typeof this.createdTimestampAt === "number";
  }

  public isFederatedIdentity() {
    return !!this.federatedIdentity;
  }
}
