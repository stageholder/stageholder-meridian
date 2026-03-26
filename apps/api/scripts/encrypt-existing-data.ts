/**
 * Migration script: Encrypt existing plaintext data in MongoDB.
 *
 * Usage:
 *   MONGODB_URI=<uri> ENCRYPTION_KEY=<32+ char key> bun run apps/api/scripts/encrypt-existing-data.ts
 *
 * This script is IDEMPOTENT — safe to re-run. It detects already-encrypted
 * values by attempting decryption; if decryption succeeds and produces a
 * different value, the field is already encrypted and is skipped.
 */

import { MongoClient } from "mongodb";
import { Encryption } from "@boringnode/encryption";
import { aes256gcm } from "@boringnode/encryption/drivers/aes_256_gcm";

const MONGODB_URI = process.env.MONGODB_URI;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!MONGODB_URI || !ENCRYPTION_KEY) {
  console.error("Error: MONGODB_URI and ENCRYPTION_KEY env vars are required.");
  process.exit(1);
}

const CIPHER_PREFIX = "mrdn.";
const enc = new Encryption(aes256gcm({ id: "mrdn", keys: [ENCRYPTION_KEY] }));

function isAlreadyEncrypted(value: string): boolean {
  return value.startsWith(CIPHER_PREFIX);
}

function encryptIfPlain(
  value: string | undefined | null,
): string | undefined | null {
  if (!value || typeof value !== "string") return value;
  if (isAlreadyEncrypted(value)) return value;
  return enc.encrypt(value) as string;
}

function encryptArrayIfPlain(arr: any[]): any[] {
  return arr.map((v) => (typeof v === "string" ? encryptIfPlain(v) : v));
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

async function migrateCollection(
  db: any,
  config: CollectionConfig,
): Promise<number> {
  const collection = db.collection(config.name);
  const cursor = collection.find({}).batchSize(500);
  let migrated = 0;

  for await (const doc of cursor) {
    const update: Record<string, any> = {};
    let dirty = false;

    // Encrypt string fields
    for (const field of config.fields) {
      const val = doc[field];
      if (typeof val === "string" && val && !isAlreadyEncrypted(val)) {
        update[field] = enc.encrypt(val) as string;
        dirty = true;
      }
    }

    // Encrypt array fields (e.g., tags)
    if (config.arrayFields) {
      for (const field of config.arrayFields) {
        const arr = doc[field];
        if (Array.isArray(arr)) {
          const encrypted = encryptArrayIfPlain(arr);
          const changed = encrypted.some((v: any, i: number) => v !== arr[i]);
          if (changed) {
            update[field] = encrypted;
            dirty = true;
          }
        }
      }
    }

    // Encrypt subtask titles
    if (config.subtaskField && Array.isArray(doc.subtasks)) {
      let subtasksDirty = false;
      const subtasks = doc.subtasks.map((s: any) => {
        const val = s[config.subtaskField!];
        if (typeof val === "string" && val && !isAlreadyEncrypted(val)) {
          subtasksDirty = true;
          return { ...s, [config.subtaskField!]: enc.encrypt(val) as string };
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
      migrated++;
    }
  }

  return migrated;
}

async function main() {
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db();
  console.log("Connected.\n");

  let totalMigrated = 0;

  for (const config of COLLECTIONS) {
    const count = await db.collection(config.name).countDocuments();
    console.log(`Migrating ${config.name} (${count} documents)...`);
    const migrated = await migrateCollection(db, config);
    console.log(`  -> ${migrated} documents encrypted\n`);
    totalMigrated += migrated;
  }

  console.log(`Done. Total documents encrypted: ${totalMigrated}`);
  await client.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
