import { customAlphabet } from "nanoid";


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
