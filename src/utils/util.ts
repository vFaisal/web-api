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

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: any) {
  let encoded = "";

  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      const index = (value >> (bits - 5)) & 0x1f;
      encoded += base32Alphabet[index];
      bits -= 5;
    }
  }

  if (bits > 0) {
    const index = (value << (5 - bits)) & 0x1f;
    encoded += base32Alphabet[index];
  }

  return encoded;
}

export function base32Decode(encoded: any) {
  let buffer = Buffer.alloc(Math.ceil((encoded.length * 5) / 8));

  let bits = 0;
  let value = 0;
  let bufferIndex = 0;

  for (const char of encoded) {
    const index = base32Alphabet.indexOf(char);
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      buffer[bufferIndex++] = (value >> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }

  return buffer;
}
