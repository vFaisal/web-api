import { IsDefined, IsString, Matches, MaxLength, MinLength } from "class-validator";


export default class FederatedIdentityQueryDto {
  @IsDefined()
  @MinLength(1)
  @MaxLength(128)
  code: string;

  @IsDefined()
  @MinLength(1)
  @MaxLength(64)
  state: string;
}
