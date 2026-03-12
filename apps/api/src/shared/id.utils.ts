import { randomUUID } from "crypto";
import { nanoid } from "nanoid";

export function generateId(): string {
  return randomUUID();
}

export function generateShortId(size = 12): string {
  return nanoid(size);
}
