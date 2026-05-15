import { registerPayloadTransform } from "@repo/offline/sync/mutation-queue";
import { useEncryptionStore } from "./encryption-store";
import { encryptJournalPayload } from "./journal-crypto";

export function registerJournalEncryptionTransform(): void {
  registerPayloadTransform("journals", async (payload, operation) => {
    if (operation === "delete") return payload;

    const dek = useEncryptionStore.getState().dek;
    if (!dek) {
      throw new Error(
        "Encryption key not available — journal mutation will retry later",
      );
    }

    const raw = payload as Record<string, unknown>;

    // Update mutations have shape { id, data: { title, content, ... } }
    // Create mutations have shape { title, content, ... }
    const isUpdate =
      "data" in raw && typeof raw.data === "object" && raw.data !== null;
    const fields = isUpdate ? (raw.data as Record<string, unknown>) : raw;

    const encrypted = await encryptJournalPayload(
      {
        title: (fields.title as string) || "",
        content: (fields.content as string) || "",
        tags: (fields.tags as string[]) || [],
        mood: fields.mood as number | undefined,
        date: fields.date as string | undefined,
      },
      dek,
    );

    if (isUpdate) {
      return { id: raw.id, data: encrypted };
    }
    return encrypted;
  });
}
