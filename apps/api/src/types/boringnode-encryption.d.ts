declare module "@boringnode/encryption/drivers/aes_256_gcm" {
  import type { Secret } from "@poppinss/utils";

  interface AES256GCMDriverConfig {
    id: string;
    keys: (string | Secret<string>)[];
  }

  export function aes256gcm(config: AES256GCMDriverConfig): any;
}
