import { IsDefined, IsString, Matches, MinLength } from "class-validator";


export default class FederatedIdentityQuery {
  @IsDefined()
  @MinLength(1)
  code: string;

  @IsDefined()
  @MinLength(1)
  state: string;
}
