import { Expose } from 'class-transformer';
import { AccountSession, AccountSessionTokens, Visitor } from '@prisma/client';
import { UAParser } from 'ua-parser-js';
import Constants from '../../../utils/constants';
import { isIP } from 'class-validator';

export default class TrustedAccountSessionEntity {
  id: string;
  isCurrentSession: boolean;

  activity: ActivityLogin[];

  lastSeen: number;

  createdAt: number;

  constructor(
    session: Partial<
      AccountSession & {
        tokens: (Partial<AccountSessionTokens> & {
          visitor: Partial<Visitor>;
        })[];
      }
    >,
    currentSessionToken: string,
  ) {
    this.id = session.publicId;
    this.activity = session.tokens.map((t) => {
      let userAgentParsed = new UAParser(t.visitor.userAgent);
      return {
        client: {
          os: {
            name: userAgentParsed.getOS().name ?? null,
            version: userAgentParsed.getOS().version ?? null,
          },
          browser: {
            name: userAgentParsed.getBrowser().name ?? null,
            version: userAgentParsed.getBrowser().version ?? null,
          },
          device: {
            isMobile: userAgentParsed.getDevice().type === 'mobile',
            type: userAgentParsed.getDevice().type ?? null,
            model: userAgentParsed.getDevice().model ?? null,
            brand: userAgentParsed.getDevice().vendor ?? null,
          },
        },
        counter: Constants.COUNTRIES[t.visitor.counterCode] ?? null,
        counterCode:
          t.visitor.counterCode?.length === 2 ? t.visitor.counterCode : null,
        location: null,
        region: null,
        ip:
          t.visitor.ipAddress && isIP(t.visitor.ipAddress)
            ? t.visitor.ipAddress
            : null,
        createdAt: Math.round(t.createdAt.getTime() / 1000),
      };
    });
    this.isCurrentSession = !!session.tokens.find(
      (t) => t.token === currentSessionToken,
    );
    this.lastSeen = this.activity.at(-1).createdAt;
    this.createdAt = Math.round(session.createdAt.getTime() / 1000);
  }

  @Expose()
  get suspiciousLevel(): number {
    // Max 5
    return 0;
  }
}

interface ActivityLogin {
  ip: string;
  counter: string;
  counterCode: string;
  location: string;
  region: string | null;
  client: {
    os: {
      name: string | null;
      version: string | null;
    };
    device: {
      isMobile: boolean | null;
      type: string | null;
      model: string | null;
      brand: string | null;
    };
    browser: {
      name: string | null;
      version: string | null;
    };
  };
  createdAt: number;
}
