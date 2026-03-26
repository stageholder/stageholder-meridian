import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Encryption } from "@boringnode/encryption";
import { aes256gcm } from "@boringnode/encryption/drivers/aes_256_gcm";

/** Ciphertext prefix used by the configured driver (id: "mrdn") */
const CIPHER_PREFIX = "mrdn.";

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private enc!: Encryption;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const key = this.config.get<string>("ENCRYPTION_KEY");
    if (!key) {
      this.logger.warn(
        "ENCRYPTION_KEY not set — encryption is disabled (plaintext mode)",
      );
      return;
    }
    this.enc = new Encryption(aes256gcm({ id: "mrdn", keys: [key] }));
    this.enabled = true;
    this.logger.log("EncryptionService initialized with AES-256-GCM");
  }

  encrypt(value: string | undefined | null): string | undefined {
    if (value == null || value === "" || !this.enabled) {
      return value ?? undefined;
    }
    return this.enc.encrypt(value) as string;
  }

  decrypt(value: string | undefined | null): string | undefined {
    if (value == null || value === "" || !this.enabled) {
      return value ?? undefined;
    }
    // Pre-migration plaintext: not ciphertext, return as-is
    if (!value.startsWith(CIPHER_PREFIX)) {
      return value;
    }
    try {
      const decrypted = this.enc.decrypt(value);
      return (decrypted as string) ?? value;
    } catch (err) {
      this.logger.error(
        `Failed to decrypt value (key mismatch or corruption): ${(err as Error).message}`,
      );
      return value;
    }
  }

  /** Check if a value looks like ciphertext produced by this service */
  isCiphertext(value: string): boolean {
    return value.startsWith(CIPHER_PREFIX);
  }

  encryptRecord<T extends Record<string, any>>(record: T, fields: string[]): T {
    if (!this.enabled) return record;
    const result = { ...record };
    for (const path of fields) {
      this.applyToPath(result, path, (v) => this.encrypt(v)!);
    }
    return result;
  }

  decryptRecord<T extends Record<string, any>>(record: T, fields: string[]): T {
    if (!this.enabled) return record;
    const result = { ...record };
    for (const path of fields) {
      this.applyToPath(result, path, (v) => this.decrypt(v)!);
    }
    return result;
  }

  /** Supported path syntax: "field", "field" (string[]), "array[*].field" (one level only) */
  private applyToPath(
    obj: Record<string, any>,
    path: string,
    fn: (v: string) => string,
  ): void {
    if (path.includes("[*].")) {
      const [arrayKey, nestedKey] = path.split("[*].") as [string, string];
      const arr = obj[arrayKey];
      if (!Array.isArray(arr)) return;
      obj[arrayKey] = arr.map((item) => {
        if (item && typeof item[nestedKey] === "string" && item[nestedKey]) {
          return { ...item, [nestedKey]: fn(item[nestedKey]) };
        }
        return item;
      });
    } else {
      const val = obj[path];
      if (typeof val === "string" && val) {
        obj[path] = fn(val);
      } else if (Array.isArray(val)) {
        obj[path] = val.map((v) => (typeof v === "string" && v ? fn(v) : v));
      }
    }
  }
}
