import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NANOID_REGEX = /^[A-Za-z0-9_-]{10,30}$/;

@Injectable()
export class ParseIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (UUID_V4_REGEX.test(value) || NANOID_REGEX.test(value)) {
      return value;
    }
    throw new BadRequestException(`Invalid ID format: "${value}"`);
  }
}
