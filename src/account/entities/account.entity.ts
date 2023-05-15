import { Exclude, Expose } from "class-transformer";
import { Account, AccountFederatedIdentities, Provider } from "@prisma/client";

export class AccountEntity {

  @Exclude()
  id: bigint;

  publicId: string;

  displayName: string | null;

  email: string;

  @Exclude()
  passwordHash: string | null;

  @Exclude()
  emailVerifiedAt: Date;

  @Exclude()
  updatedAt: Date;

  federatedIdentities: Provider[];

  createdAt: Date;

  constructor(account: Partial<Account>, federatedIdentities?: Partial<AccountFederatedIdentities>[]) {
    Object.assign(this, account);
    this.federatedIdentities = federatedIdentities?.map(f => f.provider) ?? [];
  }

  @Expose()
  get verification() {
    return {
      email: !!this.emailVerifiedAt
    };
  }


}
