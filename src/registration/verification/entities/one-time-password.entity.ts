import { unixTimestamp } from "../../../utils/util";
import { ServiceUnavailableException } from "@nestjs/common";

export default class OneTimePasswordEntity<T extends "CREATION" | "GET"> {
  public readonly phoneOrEmail: string;
  public readonly target: "EMAIL" | "PHONE";
  public readonly signature: string;
  public readonly hashCode: string;
  public readonly intent: "REGISTRATION";
  public attempts: number;
  public readonly allowedAttempts: number;
  public verifiedAt: number;
  public readonly createdTimestampAt: number;


  constructor(data: T extends "CREATION" ? {
    phoneOrEmail: string;
    target: "EMAIL" | "PHONE";
    signature: string;
    hashCode: string;
    intent: "REGISTRATION";
    attempts: number;
    allowedAttempts: number;
    createdTimestampAt: number;
  } : any) {
    this.phoneOrEmail = data?.phoneOrEmail;
    this.signature = data?.signature;
    this.hashCode = data?.hashCode;
    this.intent = data?.intent;
    this.target = data?.target;
    this.attempts = data?.attempts;
    this.allowedAttempts = data?.allowedAttempts;
    this.verifiedAt = data?.verifiedAt;
    this.createdTimestampAt = data?.createdTimestampAt;
  }

  public isValid() {
    return typeof this.phoneOrEmail === "string" && typeof this.target === "string" && typeof this.signature === "string" && typeof this.hashCode === "string" && typeof this.intent === "string" && typeof this.attempts === "number" && typeof this.allowedAttempts === "number" && typeof this.createdTimestampAt === "number";
  }

  public verify() {
    this.verifiedAt = unixTimestamp();
  }

  public isVerified() {
    return !!this.verifiedAt;
  }
}
