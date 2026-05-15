import { encryptJournal, decryptJournal } from "@repo/crypto";
import type { Journal } from "@repo/core/types";

export async function encryptJournalPayload(
  data: {
    title: string;
    content: string;
    tags?: string[];
    mood?: number;
    date?: string;
  },
  dek: CryptoKey,
): Promise<{
  title: string;
  content: string;
  tags: string;
  mood?: number;
  date?: string;
  encrypted: true;
  wordCount: number;
}> {
  const wordCount = countWords(data.content);
  const encrypted = await encryptJournal(
    {
      title: data.title,
      content: data.content,
      tags: data.tags ?? [],
    },
    dek,
  );
  return {
    ...encrypted,
    mood: data.mood,
    date: data.date,
    encrypted: true,
    wordCount,
  };
}

export async function decryptJournalResponse(
  journal: Journal,
  dek: CryptoKey,
): Promise<Journal> {
  if (!journal.encrypted) return journal;
  const decrypted = await decryptJournal(
    {
      title: journal.title,
      content: journal.content,
      tags: journal.tags as string,
    },
    dek,
  );
  return {
    ...journal,
    title: decrypted.title,
    content: decrypted.content,
    tags: decrypted.tags,
  };
}

export async function decryptJournalList(
  journals: Journal[],
  dek: CryptoKey,
): Promise<Journal[]> {
  return Promise.all(journals.map((j) => decryptJournalResponse(j, dek)));
}

function countWords(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length === 0) return 0;
  return text.split(" ").length;
}
