import { Exclude, Expose } from 'class-transformer';
import { Account, AccountFederatedIdentities, Provider } from '@prisma/client';
import R2Service from '../../providers/r2.service';

export class AccountEntity {
  @Exclude()
  public raw: {
    account: Partial<Account>;
    federatedIdentities: Partial<AccountFederatedIdentities>[];
  } = {
    account: null,
    federatedIdentities: [],
  };

  constructor(
    account: Partial<Account>,
    federatedIdentities?: Partial<AccountFederatedIdentities>[],
  ) {
    this.raw.account = account;
    this.raw.federatedIdentities = federatedIdentities ?? [];
  }

  @Expose()
  public get id() {
    return this.raw.account.publicId;
  }

  @Expose()
  public get displayName() {
    return this.raw.account.displayName;
  }

  @Expose()
  public get photoUrl() {
    return this.raw.account.photoHash
      ? R2Service.PUBLIC_CDN_DOMAIN + '/' + this.raw.account.photoHash
      : null;
  }

  @Expose()
  public get email() {
    return this.raw.account.email;
  }

  @Expose()
  public get phone() {
    return this.havePhoneNumber()
      ? {
          // country: "",
          prefix: '+' + this.raw.account.phoneCountryCode,
          number: this.raw.account.phoneNumber,
          full:
            '+' +
            this.raw.account.phoneCountryCode +
            this.raw.account.phoneCountryCode,
        }
      : null;
  }

  @Expose()
  public get verified() {
    const verified = [];
    if (this.raw.account.emailVerifiedAt) verified.push('EMAIL');
    if (this.havePhoneNumber() && this.raw.account.phoneVerifiedAt)
      verified.push('PHONE');
    return verified /*{
      email: !!this.raw.account.emailVerifiedAt,
      phone: !!(this.havePhoneNumber() && this.raw.account.phoneVerifiedAt)
    }*/;
  }

  @Expose()
  public get twoFactor() {
    const methods: Array<'EMAIL' | 'SMS' | 'WHATSAPP' | 'APP'> = [];
    if (this.raw.account.twoFactorAuthEmail && this.raw.account.emailVerifiedAt)
      methods.push('EMAIL');
    if (
      this.raw.account.twoFactorAuthSMS &&
      this.raw.account.phoneVerifiedAt &&
      this.havePhoneNumber()
    )
      methods.push('SMS');
    if (this.raw.account.twoFactorAuthWhatsapp) methods.push('WHATSAPP');
    if (this.raw.account.twoFactorAuthAppKey) methods.push('APP');
    return {
      configured: methods.length > 0,
      methods /*: {
        email: !!(!!this.raw.account.twoFactorAuthEmail && !!this.raw.account.emailVerifiedAt),
        sms: !!(!!this.raw.account.twoFactorAuthSMS && !!this.raw.account.phoneVerifiedAt && !!this.havePhoneNumber()),
        whatsapp: !!this.raw.account.twoFactorAuthWhatsapp,
        authenticationApp: !!this.raw.account.twoFactorAuthAppKey
      }*/,
    };
  }

  @Expose()
  public get federatedIdentities() {
    return this.raw.federatedIdentities?.map((f) => f.provider) ?? [];
  }

  @Expose()
  public get createdAt() {
    return this.raw.account.createdAt;
  }

  private havePhoneNumber() {
    return this.raw.account.phoneNumber && this.raw.account.phoneCountryCode;
  }
}
