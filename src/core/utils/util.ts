import { customAlphabet } from 'nanoid';
import { lookup } from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import Constants from './constants';
import { FastifyRequest } from 'fastify';
import { InternalServerErrorException } from '@nestjs/common';

export function generateNanoId(size = 16): string {
  return customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', size)();
}

export function unixTimestamp(increment?: number): number;
export function unixTimestamp(
  increment?: number,
  returnType?: 'unixTimestamp',
): number;
export function unixTimestamp(increment?: number, returnType?: 'DATE'): Date;
export function unixTimestamp(
  increment?: number,
  returnType: 'DATE' | 'unixTimestamp' = 'unixTimestamp',
): Date | number {
  const timestamp = Math.round(Date.now() / 1000) + (increment ?? 0);
  return returnType === 'DATE' ? new Date(timestamp * 1000) : timestamp;
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export type SignificantRequestInformation = {
  ipAddress: string;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  country: string | null;
  isp: string | null;
  userAgent: string;
};

export function significantRequestInformation(
  req: FastifyRequest,
): SignificantRequestInformation {
  /*
   * This custom headers must be configured by load balancer.
   */
  const ipAddress = req.headers['x-client-real-ip'] as string;
  const city = req.headers['x-client-geo-city'] as string;
  const regionSubdivision = req.headers[
    'x-client-geo-region-subdivision'
  ] as string;
  const countryCode = req.headers['x-client-geo-region'] as string;
  const country = countryCode ? Constants.COUNTRIES[countryCode] : null;
  if (!ipAddress || !countryCode) {
    console.error("Header not been configured.", req.headers)
    throw new InternalServerErrorException();
  }
  return {
    ipAddress,
    city: city ?? null,
    region: regionSubdivision ?? null,
    countryCode: countryCode,
    country: country ?? null,
    isp: null,
    userAgent: req.headers['user-agent'],
  };
}

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: any) {
  let encoded = '';

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

export function hideEmail(email: string) {
  const split = email.split('@');

  const partOne =
    split[0].length >= 3 ? split[0].slice(0, 3) + '**' : split[0] + '**';
  const domain = split[1].split('.');
  const partTwo = domain[0].slice(0, 1) + '****';
  const partThree = domain[1];
  return partOne + '@' + partTwo + '.' + partThree;
}

export function hidePhone(phoneNumber) {
  const visiblePart = phoneNumber.slice(-4);
  const hiddenPart = '*'.repeat(phoneNumber.length - 4);

  return hiddenPart + visiblePart;
}

export function requesterInformationAsEmail(
  sqi: SignificantRequestInformation,
) {
  const userAgentParsed = new UAParser(sqi.userAgent);
  const os = userAgentParsed.getOS().name ?? '';
  const browser = userAgentParsed.getBrowser().name ?? '';
  return `Location: ${
    sqi.city ? sqi.city + ', ' + sqi.country : sqi.country ?? ''
  } (IP: ${sqi.ipAddress})\nPlatform: ${browser} browser on ${os} device`;
}
