const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const DEK_LENGTH = 256;

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

export async function deriveMasterKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-KW", length: DEK_LENGTH },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

export async function generateDEK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: DEK_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function wrapDEK(
  dek: CryptoKey,
  masterKey: CryptoKey,
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey("raw", dek, masterKey, "AES-KW");
  return toBase64(wrapped);
}

export async function unwrapDEK(
  wrappedBase64: string,
  masterKey: CryptoKey,
): Promise<CryptoKey> {
  const wrapped = fromBase64(wrappedBase64);
  return crypto.subtle.unwrapKey(
    "raw",
    wrapped,
    masterKey,
    "AES-KW",
    { name: "AES-GCM", length: DEK_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );
}

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function fromBase64(str: string): ArrayBuffer {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function saltToBase64(salt: Uint8Array): string {
  return toBase64(salt.buffer as ArrayBuffer);
}

export function saltFromBase64(str: string): Uint8Array {
  return new Uint8Array(fromBase64(str));
}
