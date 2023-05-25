import { customAlphabet } from "nanoid";
import { Request } from "express";
import { lookup } from "geoip-lite";

export function generateNanoId(size = 16): string {
  return customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", size)();
}


export function unixTimestamp(increment?: number): number;
export function unixTimestamp(increment?: number, returnType?: "unixTimestamp"): number;
export function unixTimestamp(increment?: number, returnType?: "DATE"): Date;
export function unixTimestamp(increment?: number, returnType: "DATE" | "unixTimestamp" = "unixTimestamp"): Date | number {
  const timestamp = Math.round(Date.now() / 1000) + (increment ?? 0);
  return (returnType === "DATE") ? new Date(timestamp * 1000) : timestamp;
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}


export type SignificantRequestInformation = {
  ipAddress: string,
  city: string | null,
  region: string | null,
  countryCode: string | null,
  isp: string | null,
  userAgent: string,
}

export function significantRequestInformation(req: Request): SignificantRequestInformation {
  const ipAddress = req.ip;
  const geo = lookup(ipAddress);
  return {
    ipAddress,
    city: geo?.city ?? null,
    region: geo?.region ?? null,
    countryCode: geo?.country ?? null,
    isp: null,
    userAgent: req.headers["user-agent"]
  };
}
