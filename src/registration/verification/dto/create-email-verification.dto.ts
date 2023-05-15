import { IsDefined, Matches } from "class-validator";
import Constants from "../../../utils/constants";

export default class CreateEmailVerificationDto {
  @IsDefined()
  @Matches(Constants.EMAIL_VALIDATION_REGEX)
  email: string;

}