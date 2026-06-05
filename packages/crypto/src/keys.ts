import {
  type PortableKey,
  getRandomBytes,
  deriveKwKey,
  generateGcmKey,
  wrapKeyRaw,
  unwrapKeyRaw,
} from "./primitives";

// Re-export the platform key type so consumers can name it. On web a
// PortableKey IS a CryptoKey (see primitives.ts), so every existing PWA call
// site that passes a CryptoKey keeps typechecking unchanged; on native it is an
// opaque key holder (see primitives.native.ts). Metro/Vite pick the matching
// primitives module via the relative "./primitives" import.
export type { PortableKey };

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;

export function generateSalt(): Uint8Array {
  return getRandomBytes(SALT_LENGTH);
}

export async function deriveMasterKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<PortableKey> {
  const encoder = new TextEncoder();
  return deriveKwKey(encoder.encode(passphrase), salt, PBKDF2_ITERATIONS);
}

export async function generateDEK(): Promise<PortableKey> {
  return generateGcmKey();
}

export async function wrapDEK(
  dek: PortableKey,
  masterKey: PortableKey,
): Promise<string> {
  const wrapped = await wrapKeyRaw(dek, masterKey);
  return toBase64(wrapped);
}

export async function unwrapDEK(
  wrappedBase64: string,
  masterKey: PortableKey,
): Promise<PortableKey> {
  const wrapped = fromBase64(wrappedBase64);
  return unwrapKeyRaw(wrapped, masterKey);
}

// Base64 helpers live in this shared (web-truth) file — btoa/atob are available
// on both browsers and Hermes (RN 0.81), so no platform split is needed here.
// Accepts a Uint8Array or ArrayBuffer so it works for both the byte arrays the
// primitive layer returns and any raw buffers callers still hand in.
export function toBase64(buf: Uint8Array | ArrayBuffer): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function saltToBase64(salt: Uint8Array): string {
  return toBase64(salt);
}

export function saltFromBase64(str: string): Uint8Array {
  return fromBase64(str);
}

/**
 * Derive the recovery-path AES-KW key from the 8 recovery codes. Codes are
 * sorted-then-concatenated so any order yields the same key. Salt is the
 * user's OIDC sub (stable unique identifier). Parameters MUST match the
 * server-side verification recipe exactly; both sides agree byte-for-byte.
 */
export async function deriveRecoveryMasterKey(
  codes: string[],
  userSub: string,
): Promise<PortableKey> {
  const sorted = [...codes].sort().join("");
  const encoder = new TextEncoder();
  return deriveKwKey(
    encoder.encode(sorted),
    encoder.encode(userSub),
    PBKDF2_ITERATIONS,
  );
}
