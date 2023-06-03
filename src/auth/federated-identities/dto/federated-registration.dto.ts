import { IsDefined, IsString, Matches, MinLength } from "class-validator";
import Constants from "../../../utils/constants";


export default class FederatedRegistrationDto {
  @Matches(Constants.EMAIL_VALIDATION_REGEX)
  email: string;

  @Matches(/^[a-z0-9]{64}$/i)
  signature: string;
}
