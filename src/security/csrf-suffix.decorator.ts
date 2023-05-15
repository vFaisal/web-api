import { SetMetadata } from "@nestjs/common";

export const CSRFSuffix = (suffix: string) => SetMetadata("csrfSuffix", suffix);
