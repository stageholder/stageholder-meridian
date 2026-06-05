// ---------------------------------------------------------------------------
// Crypto PRIMITIVES — WEB implementation (WebCrypto / SubtleCrypto).
//
// This file is the single low-level boundary between the higher-level key /
// cipher logic (keys.ts, cipher.ts, recovery.ts) and the platform's crypto
// engine. The platform-split sibling `primitives.native.ts` MUST produce the
// EXACT SAME BYTES for every operation — web and React Native clients sync the
// same encrypted journals, so a divergence here means one platform cannot
// decrypt the other's data.
//
// WIRE FORMAT (must stay identical across web + native — change one, change both):
//   • AES-GCM field blob : base64( iv[12] || ciphertext || gcmTag[16] )
//       NOTE: on WebCrypto the value returned by subtle.encrypt ALREADY ENDS
//       WITH the 16-byte GCM auth tag, so gcmEncrypt here returns
//       `ciphertext || tag` directly. The native side has to re-append the tag
//       manually because node-style GCM hands the tag back separately.
//   • AES-KW (key wrap)  : RFC 3394 with the standard default IV
//       (0xA6A6A6A6A6A6A6A6). WebCrypto's "AES-KW" and @noble/ciphers' `aeskw`
//       both use this default IV → byte-compatible wrapped keys.
//   • Key derivation     : PBKDF2-HMAC-SHA256, 600_000 iterations, 32-byte
//       (256-bit) output used as an AES-KW key-encryption key.
// ---------------------------------------------------------------------------

const KW_KEY_LENGTH = 256; // AES-KW key size in bits
const GCM_KEY_LENGTH = 256; // AES-GCM key size in bits

// On web a PortableKey is just a WebCrypto CryptoKey. Higher layers annotate
// their public signatures with PortableKey; because this alias resolves to
// CryptoKey on web, every existing PWA call site keeps typechecking unchanged.
export type PortableKey = CryptoKey;

export function getRandomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/**
 * PBKDF2-SHA256 → non-extractable AES-KW-256 key (usages: wrapKey/unwrapKey).
 * The derived key is non-extractable: the KEK never leaves the crypto engine,
 * only wrapped DEKs cross the boundary.
 */
export async function deriveKwKey(
  secret: Uint8Array,
  salt: Uint8Array,
  iterations: number,
): Promise<PortableKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    secret as unknown as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-KW", length: KW_KEY_LENGTH },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

/**
 * Fresh AES-GCM-256 data-encryption key. Extractable so it can be wrapped
 * (subtle.wrapKey requires the key to be exportable as raw bytes).
 */
export async function generateGcmKey(): Promise<PortableKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: GCM_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );
}

/** Wrap a DEK with a KEK using AES-KW (RFC 3394). Returns the wrapped bytes. */
export async function wrapKeyRaw(
  dek: PortableKey,
  kek: PortableKey,
): Promise<Uint8Array> {
  const wrapped = await crypto.subtle.wrapKey("raw", dek, kek, "AES-KW");
  return new Uint8Array(wrapped);
}

/**
 * Unwrap AES-KW-wrapped bytes back into an extractable AES-GCM-256 key
 * (usages: encrypt/decrypt) — mirrors the import flags of generateGcmKey so a
 * wrapped-then-unwrapped DEK behaves identically to a freshly generated one.
 */
export async function unwrapKeyRaw(
  wrapped: Uint8Array,
  kek: PortableKey,
): Promise<PortableKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    wrapped as unknown as BufferSource,
    kek,
    "AES-KW",
    { name: "AES-GCM", length: GCM_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * AES-GCM encrypt with a caller-supplied 12-byte IV. Returns ciphertext with
 * the 16-byte auth tag appended — which is exactly the byte layout WebCrypto's
 * subtle.encrypt emits, so we can return it verbatim. (The native side must
 * concat the separately-returned tag to match this.)
 */
export async function gcmEncrypt(
  key: PortableKey,
  iv: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const result = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    plaintext as unknown as BufferSource,
  );
  return new Uint8Array(result);
}

/**
 * AES-GCM decrypt. `ciphertextWithTag` is ciphertext || tag[16] — the layout
 * WebCrypto's subtle.decrypt expects, so we pass it through unchanged.
 */
export async function gcmDecrypt(
  key: PortableKey,
  iv: Uint8Array,
  ciphertextWithTag: Uint8Array,
): Promise<Uint8Array> {
  const result = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    ciphertextWithTag as unknown as BufferSource,
  );
  return new Uint8Array(result);
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    data as unknown as BufferSource,
  );
  return new Uint8Array(digest);
}
