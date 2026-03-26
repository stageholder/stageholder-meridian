import { toBase64, fromBase64 } from "./keys";

const IV_LENGTH = 12;

export async function encryptField(
  plaintext: string,
  dek: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    encoder.encode(plaintext),
  );

  // Combine IV + ciphertext into a single buffer
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return toBase64(combined.buffer);
}

export async function decryptField(
  encoded: string,
  dek: CryptoKey,
): Promise<string> {
  const combined = new Uint8Array(fromBase64(encoded));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    dek,
    ciphertext,
  );

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
  dek: CryptoKey,
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
  dek: CryptoKey,
): Promise<JournalPlaintext> {
  const [title, content, tagsJson] = await Promise.all([
    decryptField(data.title, dek),
    decryptField(data.content, dek),
    decryptField(data.tags, dek),
  ]);
  return { title, content, tags: JSON.parse(tagsJson) };
}
