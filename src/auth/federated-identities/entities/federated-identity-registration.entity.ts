import { Provider } from '@prisma/client';

export default class FederatedIdentityRegistrationEntity<
  T extends 'CREATION' | 'GET',
> {
  public readonly signature: string;
  public readonly provider: Provider;
  public readonly userId: string;
  public readonly email: string;
  private readonly createdTimestampAt: number;

  constructor(
    data: T extends 'CREATION'
      ? {
          signature: string;
          provider: Provider;
          userId: string;
          email: string;
          createdTimestampAt: number;
        }
      : any,
  ) {
    this.signature = data?.signature;
    this.provider = data?.provider;
    this.userId = data?.userId;
    this.email = data?.email;
    this.createdTimestampAt = data?.createdTimestampAt;
  }

  public isValid() {
    return (
      typeof this.signature === 'string' &&
      typeof this.provider === 'string' &&
      typeof this.userId === 'string' &&
      typeof this.email === 'string' &&
      typeof this.createdTimestampAt === 'number'
    );
  }
}
