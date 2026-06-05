import { toBase64, fromBase64, type PortableKey } from "./keys";
import { getRandomBytes, gcmEncrypt, gcmDecrypt } from "./primitives";

const IV_LENGTH = 12;

export async function encryptField(
  plaintext: string,
  dek: PortableKey,
): Promise<string> {
  const iv = getRandomBytes(IV_LENGTH);
  const encoder = new TextEncoder();
  // gcmEncrypt returns ciphertext || gcmTag[16] on both platforms (the web
  // layout, which the native side re-creates by appending the separate tag).
  const ciphertextWithTag = await gcmEncrypt(
    dek,
    iv,
    encoder.encode(plaintext),
  );

  // Wire format: base64( iv[12] || ciphertext || gcmTag[16] )
  const combined = new Uint8Array(iv.length + ciphertextWithTag.length);
  combined.set(iv, 0);
  combined.set(ciphertextWithTag, iv.length);

  return toBase64(combined);
}

export async function decryptField(
  encoded: string,
  dek: PortableKey,
): Promise<string> {
  const combined = fromBase64(encoded);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertextWithTag = combined.slice(IV_LENGTH);

  const plaintext = await gcmDecrypt(dek, iv, ciphertextWithTag);

  return new TextDecoder().decode(plaintext);
}

export interface JournalPlaintext {
  title: string;
  content: string;
  tags: string[];
}

export interface JournalEncrypted {
  title: string;
  content: string;
  tags: string;
}

export async function encryptJournal(
  data: JournalPlaintext,
  dek: PortableKey,
): Promise<JournalEncrypted> {
  const [title, content, tags] = await Promise.all([
    encryptField(data.title, dek),
    encryptField(data.content, dek),
    encryptField(JSON.stringify(data.tags), dek),
  ]);
  return { title, content, tags };
}

export async function decryptJournal(
  data: JournalEncrypted,
  dek: PortableKey,
): Promise<JournalPlaintext> {
  const [title, content, tagsJson] = await Promise.all([
    decryptField(data.title, dek),
    decryptField(data.content, dek),
    decryptField(data.tags, dek),
  ]);
  return { title, content, tags: JSON.parse(tagsJson) };
}
