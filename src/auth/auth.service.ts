import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../core/providers/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { argon2id, hash, verify } from 'argon2';
import {
  generateNanoId,
  hideEmail,
  SignificantRequestInformation,
  unixTimestamp,
} from '../core/utils/util';
import {
  Account,
  ActivityAction,
  ActivityOperationType,
  SessionType,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import SessionEntity from './entities/session.entity';
import RedisService from '../core/providers/redis.service';
import { AccountEntity } from '../account/entities/account.entity';
import { MultiFactorLogin } from './multi-factor/multi-factor.service';
import ThrottlerService from '../core/security/throttler.service';
import Constants from '../core/utils/constants';
import { AccessLevel } from '../core/security/authorization.decorator';
import ResendService from '../core/providers/resend.service';
import AccountActivityGlobalService from '../core/services/account-activity.global.service';

@Injectable()
export class AuthService {
  private logger: Logger = new Logger('AuthService');
  public static readonly EXPIRATION = {
    ACCESS_TOKEN: 60 * 60, // 1h (Seconds)
    REFRESH_TOKEN: 60 * 60 * 24 * 14, // 14 Days (Seconds)
    MFA_VERIFY_TOKEN: 10 * 60, // 10m (Seconds)
    PASSWORD_RECOVERY_TOKEN: 2 * 60 * 60, // 2h (Seconds)
  };
  private static readonly FAILED_LOGIN_ATTEMPTS_LIMIT = 20;
  private static readonly FAILED_LOGIN_ATTEMPTS_TTL = 25 * 60; // 30 mins time reset every attempt but the value the same.
  private static readonly PASSWORD_RECOVERY_BASE_URI =
    'https://account.project.faisal.gg/forgot-password';

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly kv: RedisService,
    private readonly throttler: ThrottlerService,
    private readonly resend: ResendService,
    private readonly accountActivity: AccountActivityGlobalService,
  ) {}

  public async authenticate(
    email: string,
    password: string,
    sri: SignificantRequestInformation,
  ) {
    const account = await this.prisma.account.findUnique({
      where: {
        email,
      },
    });
    if (!account)
      throw new BadRequestException({
        code: 'email_not_registered',
        message:
          'The provided email address is not associated with any existing account.',
      });

    const safeAccountData = new AccountEntity(account);

    if (safeAccountData.isPasswordLess())
      throw new BadRequestException({
        code: 'password_login_ineligible',
        message:
          'Your account is not eligible for password-based login. Please use the provider OAuth2 method to access your account.',
      });

    if (safeAccountData.isLoginByPasswordLocked())
      throw new BadRequestException({
        code: 'account_temporarily_locked',
        message:
          'Due to excessive failed login attempts, your account is temporarily locked. It will be automatically unlocked within 2 to 24 hours.',
      });

    const isVerifiedPassword = await verify(account.passwordHash, password, {
      version: argon2id,
    });
    if (!isVerifiedPassword) {
      const cacheKey = 'failedPasswordLoginAttempts:' + account.id;
      const failedAttempts = await this.kv.get<number>(cacheKey);
      if (failedAttempts >= AuthService.FAILED_LOGIN_ATTEMPTS_LIMIT) {
        const unlockedTime = unixTimestamp(
          (account.passwordLoginUnlocked?.getTime() >
          unixTimestamp(-7 * 24 * 3600)
            ? 12
            : 2) *
            60 *
            60,
          'DATE',
        );
        await this.prisma.account.updateMany({
          where: {
            id: account.id,
          },
          data: {
            passwordLoginUnlocked: unlockedTime,
          },
        });
        this.accountActivity.create(
          account.id,
          sri,
          ActivityOperationType.NOTIFY,
          ActivityAction.ACCOUNT_PASSWORD_LOCKED,
          [
            {
              key: "passwordUnlockTimestamp",
              value: String(unlockedTime.getTime())
            }
          ]
        );
      }
      await this.kv.setex(
        cacheKey,
        AuthService.FAILED_LOGIN_ATTEMPTS_TTL,
        failedAttempts + 1,
      );

      throw new BadRequestException({
        code: 'invalid_credentials',
        message: 'The provided credentials are invalid.',
      });
    }

    return this.createCredentials(account, sri, SessionType.EMAIL);
  }

  private async createJWT(accountPublicId: string) {
    const payload: AppJWTPayload = {
      spi: generateNanoId(), // Secondary public id (from AccountSessionTokens table)
      tkn: generateNanoId(32), //Token for refresh session (from AccountSessionTokens table)
      sub: accountPublicId,
    };
    return {
      accessToken: await this.jwt.signAsync(payload, {
        expiresIn: AuthService.EXPIRATION.ACCESS_TOKEN, // 1 hour
        algorithm: 'HS256',
        secret: this.config.getOrThrow('JWT_256_SECRET'),
      }),
      refreshToken: await this.jwt.signAsync(payload, {
        expiresIn: AuthService.EXPIRATION.REFRESH_TOKEN, // 2 week
        algorithm: 'HS512',
        secret: this.config.getOrThrow('JWT_512_SECRET'),
      }),
      payload: payload,
    };
  }

  private async addCredentialsToSessionCache(
    jwtPayload: AppJWTPayload,
    primaryPublicId: string,
    accountId: bigint,
    level: AccessLevel,
  ): Promise<SessionEntity> {
    //Cache the access token for revocation (We add await if we want to use cache service like redis);
    const session = new SessionEntity({
      ppi: primaryPublicId,
      spi: jwtPayload.spi,
      tkn: jwtPayload.tkn,
      act: {
        id: accountId,
        pid: jwtPayload.sub,
      },
      cta: unixTimestamp(),
      lvl: level,
    });
    await this.kv.setex(
      `session:${jwtPayload.spi}`,
      AuthService.EXPIRATION
        .ACCESS_TOKEN /* 1 hour same the access token expiration */,
      session,
    );
    return session;
  }

  public async createCredentials(
    account: Account,
    significantRequestInformation: SignificantRequestInformation,
    sessionType: SessionType,
    force = false,
  ) {
    const safeAccountData = new AccountEntity(account);

    if (safeAccountData.isLoginByMFALocked())
      throw new BadRequestException({
        code: 'account_temporarily_locked',
        message:
          'Due to excessive failed login attempts, your account is temporarily locked. It will be automatically unlocked within 2 to 24 hours.',
      });

    if (safeAccountData.isMFAEnabled() && !force) {
      const token = generateNanoId();
      await this.kv.setex<MultiFactorLogin>(
        `MFALogin:${token}`,
        AuthService.EXPIRATION.MFA_VERIFY_TOKEN,
        {
          accountId: String(safeAccountData.raw.account.id),
          totpAttempts: 0,
          sessionType: sessionType,
        },
      );
      return {
        type: 'mfa_required',
        data: {
          email: safeAccountData.isMFAEmailEnabled()
            ? hideEmail(safeAccountData.email)
            : null,
          phone: safeAccountData.isMFASMSEnabled()
            ? safeAccountData.getPhoneWithHide()
            : null,
        },
        methods: {
          email: safeAccountData.isMFAEmailEnabled(),
          sms: safeAccountData.isMFASMSEnabled(),
          whatsapp: safeAccountData.isMFAWhatsappEnabled(),
          totp: safeAccountData.isMFAAppEnabled(),
        },
        token: token,
        expires: unixTimestamp(AuthService.EXPIRATION.MFA_VERIFY_TOKEN),
      };
    }

    const jwt = await this.createJWT(account.publicId);

    const primarySessionId = generateNanoId();
    //Add refresh token to database;
    const session = await this.prisma.accountSession.create({
      data: {
        type: sessionType,
        publicId: primarySessionId,
        accountId: account.id,
        tokens: {
          create: {
            publicId: jwt.payload.spi,
            token: jwt.payload.tkn,
            expires: unixTimestamp(
              AuthService.EXPIRATION.REFRESH_TOKEN,
              'DATE',
            ),
            accessLevel: 'MEDIUM',
            visitor: {
              create: {
                publicId: generateNanoId(),
                ipAddress: significantRequestInformation.ipAddress,
                counterCode: significantRequestInformation.countryCode,
                city: significantRequestInformation.city,
                region: significantRequestInformation.region,
                isp: significantRequestInformation.isp,
                userAgent: significantRequestInformation.userAgent,
              },
            },
          },
        },
      },
      select: {
        accountId: true,
      },
    });

    const sessionCache = await this.addCredentialsToSessionCache(
      jwt.payload,
      primarySessionId,
      session.accountId,
      AccessLevel.MEDIUM,
    );

    this.accountActivity.create(
      sessionCache,
      significantRequestInformation,
      ActivityOperationType.NOTIFY,
      ActivityAction.NEW_AUTHENTICATION,
    );

    return {
      type: 'credentials',
      accessToken: jwt.accessToken,
      expiresIn: unixTimestamp(AuthService.EXPIRATION.ACCESS_TOKEN),
      refreshToken: jwt.refreshToken,
    };
  }

  public async refreshToken(
    token: string,
    significantRequestInformation: SignificantRequestInformation,
  ) {
    const refreshTokenPayload: AppJWTPayload = await this.jwtService
      .verifyAsync(token, {
        secret: this.config.getOrThrow('JWT_512_SECRET'),
        algorithms: ['HS512'],
      })
      .catch((err) => {
        this.logger.debug('Invalid refresh token', err);
        throw new BadRequestException({
          code: 'invalid_refresh_token',
          message: 'The provided refresh token is invalid or expired.',
        });
      });

    const tokenSession = await this.prisma.accountSessionTokens.findUnique({
      where: {
        token: refreshTokenPayload.tkn,
      },
      select: {
        session: {
          select: {
            publicId: true,
            id: true,
            revokedAt: true,
            account: {
              select: {
                id: true,
                publicId: true,
              },
            },
          },
        },
      },
    });

    if (!tokenSession || tokenSession.session.revokedAt)
      throw new BadRequestException({
        code: 'invalid_refresh_token',
        message: 'The provided refresh token is invalid or expired.',
      });

    //Check if the refresh token has been used;
    const ref = await this.prisma.accountSessionTokens.findUnique({
      where: {
        ref: refreshTokenPayload.tkn,
      },
    });
    if (ref)
      throw new BadRequestException({
        code: 'invalid_refresh_token',
        message: 'The provided refresh token is invalid or expired.',
      });

    //Delete old Access
    await this.kv.del(`session:${refreshTokenPayload.spi}`);

    const jwt = await this.createJWT(tokenSession.session.account.publicId);

    const visitor = await this.prisma.visitor.create({
      data: {
        publicId: generateNanoId(),
        ipAddress: significantRequestInformation.ipAddress,
        counterCode: significantRequestInformation.countryCode,
        city: significantRequestInformation.city,
        region: significantRequestInformation.region,
        isp: significantRequestInformation.isp,
        userAgent: significantRequestInformation.userAgent,
      },
    });
    const session = await this.prisma.accountSessionTokens.create({
      data: {
        accessLevel: 'NONE',
        publicId: jwt.payload.spi,
        sessionId: tokenSession.session.id,
        token: jwt.payload.tkn,
        expires: unixTimestamp(AuthService.EXPIRATION.REFRESH_TOKEN, 'DATE'),
        ref: refreshTokenPayload.tkn,
        visitorId: visitor.id,
      },
    });

    const sessionCache = await this.addCredentialsToSessionCache(
      jwt.payload,
      tokenSession.session.publicId,
      tokenSession.session.account.id,
      AccessLevel.NONE,
    );

    this.accountActivity.create(
      sessionCache,
      significantRequestInformation,
      ActivityOperationType.NOTIFY,
      ActivityAction.REFRESH_AUTHENTICATION,
    );

    return {
      accessToken: jwt.accessToken,
      expiresIn: unixTimestamp(AuthService.EXPIRATION.ACCESS_TOKEN),
      refreshToken: jwt.refreshToken,
    };
  }

  public async selfRevokeSession(
    session: SessionEntity,
    sri: SignificantRequestInformation,
  ) {
    const sessionToken = await this.prisma.accountSessionTokens
      .update({
        where: {
          token: session.getToken(),
        },
        data: {
          session: {
            update: {
              revokedAt: new Date(),
            },
          },
        },
        select: {
          sessionId: true,
        },
      })
      .catch(async (err) => {
        if (err.code === 'P2025') {
          await this.kv.del(`session:${session.getSecondaryPublicId()}`);
          throw new BadRequestException({
            code: 'session_unavailable',
            message: "The session you're attempting to access is unavailable.",
          });
        }
        this.logger.error(
          'Something was wrong while revoking token.',
          session,
          err,
        );
        throw new ServiceUnavailableException();
      });

    await this.kv.del(`session:${session.getSecondaryPublicId()}`);
    this.accountActivity.create(
      session,
      sri,
      ActivityOperationType.DELETE,
      ActivityAction.SELF_SESSION_REVOKED,
      [
        {
          key: 'sessionId',
          value: String(sessionToken.sessionId),
        },
      ],
    );
  }

  public async startPasswordRecovery(
    email: string,
    sri: SignificantRequestInformation,
  ) {
    const account = await this.prisma.account.findUnique({
      where: {
        email: email,
      },
    });

    if (!account)
      throw new BadRequestException({
        code: 'email_not_registered_yet',
        message:
          'The email address you entered is not associated with any existing account.',
      });

    if (this.config.get('NODE_ENV') === 'production')
      await this.throttler.throwIfRateLimited(
        'passwordRecoveryService:ip:' + sri.ipAddress,
        2 * 60 * 60,
        10,
        'ip',
      );

    await this.throttler.throwIfRateLimited(
      'passwordRecoveryService:account:' + account.id,
      2 * 60 * 60,
      4,
      'data',
    );

    const token = generateNanoId(96);
    await this.kv.setex<PasswordRecoveryCache>(
      'passwordRecovery:' + token,
      AuthService.EXPIRATION.PASSWORD_RECOVERY_TOKEN,
      {
        accountId: String(account.id),
        email: account.email,
      },
    );
    const link = AuthService.PASSWORD_RECOVERY_BASE_URI + '/' + token;

    const mail =
      `Dear ${account.displayName ?? ''},\n` +
      '\n' +
      'A password reset has been requested for your account. To proceed, please follow the link provided below:\n' +
      link +
      '\n' +
      "If this request wasn't made by you, kindly disregard this email.";

    await this.resend.sendEmail(account.email, 'Password Recovery Request', {
      text: mail,
    });
  }

  public async checkPasswordRecoveryToken(token: string) {
    const recovery = await this.kv.get<PasswordRecoveryCache>(
      'passwordRecovery:' + token,
    );
    if (!recovery)
      throw new BadRequestException({
        code: 'invalid_recovery_token',
        message: 'The password recovery token provided is invalid or expired.',
      });
  }

  public async passwordRecovery(
    sri: SignificantRequestInformation,
    token: string,
    password: string,
  ) {
    const recovery = await this.kv.get<PasswordRecoveryCache>(
      'passwordRecovery:' + token,
    );
    if (!recovery)
      throw new BadRequestException({
        code: 'invalid_recovery_token',
        message: 'The password recovery token provided is invalid or expired.',
      });

    if (!Constants.PASSWORD_VALIDATION_REGEX.test(password))
      throw new BadRequestException({
        code: 'password_invalid_format',
        message:
          'The provided password format is invalid. Please use a password that adheres to the specified guidelines.',
      });
    const account = await this.prisma.account.findUniqueOrThrow({
      where: {
        id: BigInt(recovery.accountId),
      },
    });

    await this.kv.del('passwordRecovery:' + token);

    await this.prisma.account.updateMany({
      where: {
        email: recovery.email,
        id: BigInt(recovery.accountId),
      },
      data: {
        passwordHash: await hash(password, {
          version: argon2id,
        }),
        mfaLoginUnlocked:
          account.mfaLoginUnlocked?.getTime() > Date.now()
            ? new Date()
            : undefined,
        passwordLoginUnlocked:
          account.passwordLoginUnlocked?.getTime() > Date.now()
            ? new Date()
            : undefined,
      },
    });

    this.accountActivity.create(
      null,
      sri,
      ActivityOperationType.UPDATE,
      ActivityAction.PASSWORD_RECOVERED,
      [
        {
          key: 'oldPasswordHash',
          value: account.passwordHash,
        },
      ],
    );
  }
}

interface PasswordRecoveryCache {
  accountId: string;
  email: string;
}

export interface AppJWTPayload {
  sub: string;
  spi: string;
  tkn: string;
}
