import { Exclude, Expose } from 'class-transformer';
import { Account, AccountFederatedIdentities, Provider } from '@prisma/client';
import R2Service from '../../core/providers/r2.service';
import { hidePhone } from '../../core/utils/util';

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
            this.raw.account.phoneNumber,
        }
      : null;
  }

  public getPhoneWithHide() {
    if (!this.havePhoneNumber()) return null;
    const hideNumber = hidePhone(this.raw.account.phoneNumber);
    return {
      prefix: '+' + this.raw.account.phoneCountryCode,
      number: hideNumber,
      full: '+' + this.raw.account.phoneCountryCode + hideNumber,
    };
  }

  @Expose()
  public get verified() {
    /*    const verified: Array<'EMAIL' | 'PHONE'> = [];
        if (this.raw.account.emailVerifiedAt) verified.push('EMAIL');
        if (this.havePhoneNumber() && this.raw.account.phoneVerifiedAt)
          verified.push('PHONE');*/
    return {
      email: !!this.raw.account.emailVerifiedAt,
      phone: !!(this.havePhoneNumber() && this.raw.account.phoneVerifiedAt),
    };
  }

  @Expose()
  public get multiFactor() {
    /*    const methods: Array<'EMAIL' | 'SMS' | 'WHATSAPP' | 'APP'> = [];
        if (this.raw.account.mfaEmail && this.raw.account.emailVerifiedAt)
          methods.push('EMAIL');
        if (
          this.raw.account.mfaSMS &&
          this.raw.account.phoneVerifiedAt &&
          this.havePhoneNumber()
        )
          methods.push('SMS');
        if (this.raw.account.mfaWhatsapp) methods.push('WHATSAPP');
        if (this.raw.account.mfaAppKey) methods.push('APP');*/
    const isAppEnabled = !!this.raw.account.mfaAppKey;
    return {
      configured: this.isMFAEnabled(),
      methods: {
        email: this.isMFAEmailEnabled(),
        sms: this.isMFASMSEnabled(),
        whatsapp: this.isMFAWhatsappEnabled(),
        app: this.isMFAAppEnabled(),
      },
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

  public havePhoneNumber() {
    return (
      !!this.raw.account.phoneNumber && !!this.raw.account.phoneCountryCode
    );
  }

  public isMFAEmailEnabled() {
    return !!(
      !!this.raw.account.mfaEmail && !!this.raw.account.emailVerifiedAt
    );
  }

  public isMFASMSEnabled() {
    return !!(
      !!this.raw.account.mfaSMS &&
      !!this.raw.account.phoneVerifiedAt &&
      !!this.havePhoneNumber()
    );
  }

  public isMFAWhatsappEnabled() {
    return !!(!!this.raw.account.mfaWhatsapp && this.isMFASMSEnabled());
  }

  public isMFAAppEnabled() {
    return !!this.raw.account.mfaAppKey;
  }

  public isMFAEnabled() {
    return (
      this.isMFAEmailEnabled() ||
      this.isMFASMSEnabled() ||
      this.isMFAWhatsappEnabled() ||
      this.isMFAAppEnabled()
    );
  }
}
