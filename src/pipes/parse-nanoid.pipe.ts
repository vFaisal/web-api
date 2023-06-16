import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from "@nestjs/common";

@Injectable()
export default class ParseNanoidPipe implements PipeTransform {

  constructor(private readonly length: number) {
  }

  transform(value: any, metadata: ArgumentMetadata) {
    const regex = new RegExp("^[a-z0-9]{" + this.length + "}$");
    if (typeof value !== "string" || !regex.test(value)) throw new BadRequestException({
      code: "invalid_identifier",
      message: "The identifier must be a valid alphanumeric value."
    });
    return value;
  }
}
