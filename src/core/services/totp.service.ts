import { base32Decode, base32Encode } from '../utils/util';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export default class TotpService {
  //TOTP Configuration
  private static readonly ALGORITHM = 'sha1';
  private static readonly ISSUER = 'faisal.gg';
  public static readonly DIGITS = 6;
  private static readonly PERIOD = 30;

  constructor(private readonly config: ConfigService) {}

  public createSecret(key: string) {
    return base32Encode(
      createHmac('sha256', this.config.getOrThrow('APPLICATION_TOTP_KEY'))
        .update(key)
        .digest()
        .subarray(0, 20),
    );
  }

  public generateCode(secret: string) {
    const counter = Math.floor(
      Math.floor(Date.now() / 1000) / TotpService.PERIOD,
    );

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(
      BigInt(Math.floor(Math.floor(Date.now() / 1000) / TotpService.PERIOD)),
      0,
    );

    const buffer = createHmac('sha1', base32Decode(secret))
      .update(counterBuffer)
      .digest();
    const offset = buffer[buffer.length - 1] & 0x0f;
    const otp =
      (buffer.readUInt32BE(offset) & 0x7fffffff) % 10 ** TotpService.DIGITS;

    return otp.toString().padStart(TotpService.DIGITS, '0');
  }

  public createUri(secret: string, displayName: string) {
    const params = new URLSearchParams({
      secret,
      issuer: TotpService.ISSUER,
      period: String(TotpService.PERIOD),
      digits: String(TotpService.DIGITS),
      algorithm: TotpService.ALGORITHM,
    });
    return `otpauth://totp/${
      TotpService.ISSUER
    }:${displayName}?${params.toString()}`;
  }
}
