import { Exclude, Expose } from "class-transformer";
import { Account, AccountFederatedIdentities, Provider } from "@prisma/client";
import R2Service from "../../providers/r2.service";

export class AccountEntity {

  @Exclude()
  _id: bigint;

  @Exclude()
  publicId: string;

  displayName: string | null;

  email: string;

  @Exclude()
  photoHash: string | null;

  @Exclude()
  passwordHash: string | null;

  @Exclude()
  emailVerifiedAt: Date;

  @Exclude()
  updatedAt: Date;

  federatedIdentities: Provider[];

  createdAt: Date;

  constructor(account: Partial<Account>, federatedIdentities?: Partial<AccountFederatedIdentities>[]) {
    this._id = account.id;
    delete account.id;
    Object.assign(this, account);
    this.federatedIdentities = federatedIdentities?.map(f => f.provider) ?? [];
  }

  @Expose()
  get verification() {
    return {
      email: !!this.emailVerifiedAt
    };
  }

  @Expose()
  get photoUrl() {
    return (this.photoHash) ? R2Service.PUBLIC_CDN_DOMAIN + "/" + this.photoHash : null;
  }

  @Expose()
  get id() {
    return this.publicId;
  }


}
