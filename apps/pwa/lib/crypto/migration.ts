import apiClient from "@/lib/api-client";
import { encryptJournalPayload } from "./journal-crypto";

interface MigrationJournal {
  id: string;
  title: string;
  content: string;
  tags: string[];
  mood?: number;
  date: string;
  wordCount: number;
}

export async function migrateExistingJournals(
  workspaceId: string,
  dek: CryptoKey,
  onProgress?: (current: number, total: number) => void,
): Promise<number> {
  // Step 1: Get server-decrypted plaintext journals
  const res = await apiClient.post(
    `/workspaces/${workspaceId}/journals/migrate-encryption`,
  );
  const { journals, count } = res.data as {
    journals: MigrationJournal[];
    count: number;
  };

  if (count === 0) return 0;

  // Step 2: Re-encrypt each with user's DEK and update
  let migrated = 0;
  for (const journal of journals) {
    const encrypted = await encryptJournalPayload(
      {
        title: journal.title,
        content: journal.content,
        tags: journal.tags,
        mood: journal.mood,
        date: journal.date,
      },
      dek,
    );

    await apiClient.patch(
      `/workspaces/${workspaceId}/journals/${journal.id}`,
      encrypted,
    );

    migrated++;
    onProgress?.(migrated, count);
  }

  return migrated;
}
