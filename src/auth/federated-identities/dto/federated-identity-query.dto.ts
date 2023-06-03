import { IsDefined, IsString, Matches, MaxLength, MinLength } from "class-validator";


export default class FederatedIdentityQueryDto {
  @IsDefined()
  @MinLength(1)
  @MaxLength(750)
  code: string;

  @IsDefined()
  @MinLength(100)
  @MaxLength(120)
  state: string;
}
