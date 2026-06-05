// ---------------------------------------------------------------------------
// Crypto PRIMITIVES — REACT NATIVE implementation.
//
// Metro resolves this file in place of `primitives.ts` on native; Vite resolves
// the web file. Both expose the SAME surface and — critically — produce the
// EXACT SAME BYTES, because web and mobile clients sync the same encrypted
// journals. A change to one implementation is a change to both.
//
// Engine split:
//   • PBKDF2 / GCM / SHA-256 / RNG → react-native-quick-crypto (JSI native,
//     node-style API). PBKDF2 at 600k iterations is the hot path that MUST be
//     native — in pure JS on Hermes it takes tens of seconds.
//   • AES-KW (RFC 3394)            → @noble/ciphers. quick-crypto does not
//     expose key-wrap, and wrapping a 32-byte DEK is only ~24 AES block ops,
//     so a pure-JS implementation is fine here.
//
// WIRE FORMAT (must stay identical to primitives.ts — change one, change both):
//   • AES-GCM field blob : base64( iv[12] || ciphertext || gcmTag[16] )
//       THE BYTE-COMPAT TRAP: node-style GCM emits the 16-byte auth tag
//       SEPARATELY (cipher.getAuthTag()), whereas WebCrypto APPENDS it to the
//       ciphertext. So gcmEncrypt here must concat(ciphertext, tag) to match
//       the web layout, and gcmDecrypt must split the trailing 16 bytes back
//       out via setAuthTag() before final(). Get this wrong and web↔mobile
//       journals can't decrypt each other.
//   • AES-KW (key wrap)  : RFC 3394 with the standard default IV. @noble/ciphers'
//       `aeskw` uses that same default IV as WebCrypto → byte-compatible.
//   • Key derivation     : PBKDF2-HMAC-SHA256, 600_000 iterations, 32-byte
//       (256-bit) output used as the AES-KW key-encryption key.
// ---------------------------------------------------------------------------

import QuickCrypto from "react-native-quick-crypto";
// quick-crypto's own Buffer (ships as one of its deps). We use it to hand
// setAuthTag a real Buffer rather than a Uint8Array view — see gcmDecrypt.
import { Buffer } from "@craftzdog/react-native-buffer";
// Verified against node_modules/@noble/ciphers v1.3.0: the `./aes` subpath is
// exported and exposes `aeskw`, whose call shape is
// `aeskw(kekBytes).encrypt(dekBytes)` / `.decrypt(wrappedBytes)` → Uint8Array,
// implementing RFC 3394 with the standard default IV.
import { aeskw } from "@noble/ciphers/aes";

const GCM_TAG_LENGTH = 16; // bytes — AES-GCM authentication tag
const KEK_KEY_BYTES = 32; // 256-bit AES-KW key-encryption key

// quick-crypto returns its own Buffer type (@craftzdog/react-native-buffer) and
// its Cipher.update()/final() return ArrayBuffer. Normalize EVERYTHING that
// crosses the primitive boundary to a plain Uint8Array so higher layers and the
// web implementation see one consistent type.
//
// NOTE: the ArrayBufferView branch deliberately returns a VIEW (same backing
// buffer, preserved byteOffset/length) rather than a copy. That's fine for the
// values fed here — randomBytes/pbkdf2/cipher outputs are fresh, immutable
// allocations the platform won't touch again. It is NOT safe for views into
// buffers that may be mutated after return (e.g. a subarray into a noble
// internal that could be zeroed); those callsites copy explicitly instead of
// going through toBytes — see unwrapKeyRaw.
function toBytes(v: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

/**
 * On native a PortableKey is an opaque holder of the raw key bytes plus a tag
 * describing which algorithm those bytes belong to. WebCrypto keeps key
 * material inside the engine (CryptoKey is opaque); here we keep the bytes in
 * JS, but we still treat PortableKey as opaque to callers — only this module
 * reads `.bytes`. The `kind` guards against feeding a KW key to GCM or vice
 * versa, catching mismatches the WebCrypto `usages` flags would have caught.
 */
export interface PortableKey {
  readonly kind: "kw" | "gcm";
  readonly bytes: Uint8Array;
}

export function getRandomBytes(n: number): Uint8Array {
  // quick-crypto randomBytes(size) → Buffer (Uint8Array subclass). Copy to a
  // plain Uint8Array at the boundary.
  return toBytes(QuickCrypto.randomBytes(n));
}

/**
 * PBKDF2-SHA256 → 32 raw bytes wrapped as a "kw" PortableKey. We derive the KEK
 * bytes natively (the 600k-iteration hot path) and hand them to @noble's aeskw
 * at wrap/unwrap time, rather than producing an opaque engine key — keeping the
 * KW algorithm in one place (this module) on native.
 */
export async function deriveKwKey(
  secret: Uint8Array,
  salt: Uint8Array,
  iterations: number,
): Promise<PortableKey> {
  // quick-crypto's pbkdf2 is node-style: (password, salt, iterations, keylen,
  // digest, callback) where callback is (err, derivedKey: Buffer). Promisify it.
  const derived = await new Promise<Uint8Array>((resolve, reject) => {
    QuickCrypto.pbkdf2(
      secret,
      salt,
      iterations,
      KEK_KEY_BYTES,
      "sha256",
      (err: Error | null, derivedKey?: Uint8Array) => {
        if (err || !derivedKey) {
          reject(err ?? new Error("pbkdf2 returned no key"));
          return;
        }
        resolve(toBytes(derivedKey));
      },
    );
  });

  return { kind: "kw", bytes: derived };
}

/** Fresh AES-GCM-256 data-encryption key: 32 random bytes tagged "gcm". */
export async function generateGcmKey(): Promise<PortableKey> {
  return { kind: "gcm", bytes: getRandomBytes(32) };
}

/**
 * Wrap a DEK with a KEK using AES-KW (RFC 3394) via @noble/ciphers. Byte-for-
 * byte identical to WebCrypto's subtle.wrapKey("raw", …, "AES-KW") output.
 */
export async function wrapKeyRaw(
  dek: PortableKey,
  kek: PortableKey,
): Promise<Uint8Array> {
  return aeskw(kek.bytes).encrypt(dek.bytes);
}

/**
 * Unwrap AES-KW-wrapped bytes back into a "gcm" PortableKey (the unwrapped DEK
 * is an AES-GCM key, mirroring the web side's unwrap-to-AES-GCM behavior).
 */
export async function unwrapKeyRaw(
  wrapped: Uint8Array,
  kek: PortableKey,
): Promise<PortableKey> {
  // aeskw().decrypt() returns out.subarray(8) — a VIEW into noble's internal
  // 40-byte work buffer at byteOffset 8. Copy it into a fresh standalone array
  // so the PortableKey owns its bytes outright and doesn't depend on noble not
  // zeroing that buffer after return (not part of noble's public contract).
  // `new Uint8Array(subarray)` always allocates a fresh buffer at byteOffset 0.
  const dekBytes = new Uint8Array(aeskw(kek.bytes).decrypt(wrapped));
  return { kind: "gcm", bytes: dekBytes };
}

/**
 * AES-GCM encrypt. node-style GCM returns the auth tag separately via
 * getAuthTag(); WebCrypto appends it to the ciphertext. To stay byte-compatible
 * with the web blob layout we return concat(ciphertext, tag[16]).
 */
export async function gcmEncrypt(
  key: PortableKey,
  iv: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const cipher = QuickCrypto.createCipheriv("aes-256-gcm", key.bytes, iv);
  // update() + final() return ArrayBuffer here (no output encoding passed).
  const part1 = toBytes(cipher.update(plaintext));
  const part2 = toBytes(cipher.final());
  const tag = toBytes(cipher.getAuthTag()); // Buffer, 16 bytes

  const out = new Uint8Array(part1.length + part2.length + tag.length);
  out.set(part1, 0);
  out.set(part2, part1.length);
  out.set(tag, part1.length + part2.length);
  return out;
}

/**
 * AES-GCM decrypt. The web blob is ciphertext || tag[16]; node-style GCM wants
 * the tag fed in separately via setAuthTag() BEFORE final(). So split off the
 * trailing 16 bytes and register them as the auth tag.
 */
export async function gcmDecrypt(
  key: PortableKey,
  iv: Uint8Array,
  ciphertextWithTag: Uint8Array,
): Promise<Uint8Array> {
  const splitAt = ciphertextWithTag.length - GCM_TAG_LENGTH;
  const ciphertext = ciphertextWithTag.subarray(0, splitAt);
  const tag = ciphertextWithTag.subarray(splitAt);

  const decipher = QuickCrypto.createDecipheriv("aes-256-gcm", key.bytes, iv);
  // setAuthTag is typed for a Buffer. `tag` is a Uint8Array subarray (a view
  // into ciphertextWithTag), which today flows through quick-crypto's
  // binaryLikeToArrayBuffer correctly — but a future version could add a
  // Buffer.isBuffer() assertion (like Node's crypto). Wrap in Buffer.from so
  // we always hand it a genuine Buffer; Buffer.from(view) copies the 16 tag
  // bytes at the subarray's byteOffset.
  decipher.setAuthTag(Buffer.from(tag));
  const part1 = toBytes(decipher.update(ciphertext));
  const part2 = toBytes(decipher.final()); // throws if the tag doesn't verify

  const out = new Uint8Array(part1.length + part2.length);
  out.set(part1, 0);
  out.set(part2, part1.length);
  return out;
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  // createHash("sha256").update(data).digest() → Buffer.
  return toBytes(QuickCrypto.createHash("sha256").update(data).digest());
}
