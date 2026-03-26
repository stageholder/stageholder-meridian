/**
 * Key rotation script: Re-encrypt all data from OLD_KEY to NEW_KEY.
 *
 * Usage:
 *   MONGODB_URI=<uri> OLD_ENCRYPTION_KEY=<old> NEW_ENCRYPTION_KEY=<new> bun run apps/api/scripts/rotate-encryption-key.ts
 *
 * This script is IDEMPOTENT — values already encrypted with the new key are skipped.
 * Run this after deploying the new key to re-encrypt all existing data.
 */

import { MongoClient } from "mongodb";
import { Encryption } from "@boringnode/encryption";
import { aes256gcm } from "@boringnode/encryption/drivers/aes_256_gcm";

const MONGODB_URI = process.env.MONGODB_URI;
const OLD_KEY = process.env.OLD_ENCRYPTION_KEY;
const NEW_KEY = process.env.NEW_ENCRYPTION_KEY;

if (!MONGODB_URI || !OLD_KEY || !NEW_KEY) {
  console.error(
    "Error: MONGODB_URI, OLD_ENCRYPTION_KEY, and NEW_ENCRYPTION_KEY env vars are required.",
  );
  process.exit(1);
}

if (OLD_KEY === NEW_KEY) {
  console.error(
    "Error: OLD_ENCRYPTION_KEY and NEW_ENCRYPTION_KEY must differ.",
  );
  process.exit(1);
}

const OLD_PREFIX = "mrdn.";
const oldEnc = new Encryption(aes256gcm({ id: "mrdn", keys: [OLD_KEY] }));
const newEnc = new Encryption(aes256gcm({ id: "mrdn", keys: [NEW_KEY] }));

function isEncrypted(value: string): boolean {
  return value.startsWith(OLD_PREFIX);
}

function isAlreadyRotated(value: string): boolean {
  // Try decrypting with the new key — if it succeeds, already rotated
  try {
    const result = newEnc.decrypt(value);
    return result !== null;
  } catch {
    return false;
  }
}

function rotateValue(
  value: string | undefined | null,
): string | undefined | null {
  if (!value || typeof value !== "string") return value;
  if (!isEncrypted(value)) return value;
  if (isAlreadyRotated(value)) return value;

  try {
    const plaintext = oldEnc.decrypt(value) as string;
    if (plaintext == null) {
      console.warn(`  Warning: failed to decrypt value with old key, skipping`);
      return value;
    }
    return newEnc.encrypt(plaintext) as string;
  } catch (err) {
    console.warn(
      `  Warning: failed to rotate value: ${(err as Error).message}`,
    );
    return value;
  }
}

interface CollectionConfig {
  name: string;
  fields: string[];
  arrayFields?: string[];
  subtaskField?: string;
}

const COLLECTIONS: CollectionConfig[] = [
  {
    name: "journals",
    fields: ["title", "content"],
    arrayFields: ["tags"],
  },
  { name: "habits", fields: ["name", "description"] },
  { name: "habit_entries", fields: ["notes", "skip_reason"] },
  { name: "todos", fields: ["title", "description"], subtaskField: "title" },
  { name: "todo_lists", fields: ["name"] },
];

async function rotateCollection(
  db: any,
  config: CollectionConfig,
): Promise<number> {
  const collection = db.collection(config.name);
  const cursor = collection.find({}).batchSize(500);
  let rotated = 0;

  for await (const doc of cursor) {
    const update: Record<string, any> = {};
    let dirty = false;

    for (const field of config.fields) {
      const val = doc[field];
      if (typeof val === "string" && val && isEncrypted(val)) {
        const newVal = rotateValue(val);
        if (newVal !== val) {
          update[field] = newVal;
          dirty = true;
        }
      }
    }

    if (config.arrayFields) {
      for (const field of config.arrayFields) {
        const arr = doc[field];
        if (Array.isArray(arr)) {
          let arrayDirty = false;
          const rotatedArr = arr.map((v: any) => {
            if (typeof v === "string" && v && isEncrypted(v)) {
              const newVal = rotateValue(v);
              if (newVal !== v) {
                arrayDirty = true;
                return newVal;
              }
            }
            return v;
          });
          if (arrayDirty) {
            update[field] = rotatedArr;
            dirty = true;
          }
        }
      }
    }

    if (config.subtaskField && Array.isArray(doc.subtasks)) {
      let subtasksDirty = false;
      const subtasks = doc.subtasks.map((s: any) => {
        const val = s[config.subtaskField!];
        if (typeof val === "string" && val && isEncrypted(val)) {
          const newVal = rotateValue(val);
          if (newVal !== val) {
            subtasksDirty = true;
            return { ...s, [config.subtaskField!]: newVal };
          }
        }
        return s;
      });
      if (subtasksDirty) {
        update.subtasks = subtasks;
        dirty = true;
      }
    }

    if (dirty) {
      await collection.updateOne({ _id: doc._id }, { $set: update });
      rotated++;
    }
  }

  return rotated;
}

async function main() {
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db();
  console.log("Connected.\n");

  let totalRotated = 0;

  for (const config of COLLECTIONS) {
    const count = await db.collection(config.name).countDocuments();
    console.log(`Rotating ${config.name} (${count} documents)...`);
    const rotated = await rotateCollection(db, config);
    console.log(`  -> ${rotated} documents re-encrypted\n`);
    totalRotated += rotated;
  }

  console.log(`Done. Total documents re-encrypted: ${totalRotated}`);
  console.log(
    "\nNext steps:\n" +
      "  1. Verify data integrity by spot-checking a few documents\n" +
      "  2. Update ENCRYPTION_KEY env var to the new key\n" +
      "  3. Remove OLD_ENCRYPTION_KEY from your environment\n" +
      "  4. Redeploy",
  );
  await client.close();
}

main().catch((err) => {
  console.error("Key rotation failed:", err);
  process.exit(1);
});
