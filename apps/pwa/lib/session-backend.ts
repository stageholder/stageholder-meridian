import { MongoClient, type Collection } from "mongodb";
import type { SessionStorageBackend } from "@stageholder/sdk/nextjs";

/**
 * MongoDB-backed session store for the BFF.
 *
 * Sessions are persisted in a `sessions` collection alongside Meridian's
 * regular data. The `expiresAt` field is indexed with `expireAfterSeconds: 0`,
 * so MongoDB itself reaps expired rows — no app-level sweep job needed.
 *
 * The same backend is used in dev, staging, and production. Sessions
 * survive server restarts and replicate across Cloud Run replicas because
 * they live in the database, not in process memory.
 *
 * Reads use `findOne`; writes are upserts so refreshing a token doesn't
 * leak orphan rows. The collection holds opaque string blobs keyed by an
 * unguessable 32-byte session id — no PII at the schema level (the SDK
 * JSON-serialises identity into `value`, but it's not queryable).
 */
interface SessionDoc {
  _id: string;
  value: string;
  expiresAt: Date;
}

let clientPromise: Promise<MongoClient> | null = null;
let collectionPromise: Promise<Collection<SessionDoc>> | null = null;

function getCollection(): Promise<Collection<SessionDoc>> {
  if (collectionPromise) return collectionPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set on the PWA. The session backend cannot connect.",
    );
  }

  clientPromise ??= new MongoClient(uri).connect();

  collectionPromise = clientPromise.then(async (client) => {
    const db = client.db();
    const collection = db.collection<SessionDoc>("sessions");
    // TTL index — Mongo deletes the row once `expiresAt` is in the past.
    // Idempotent: createIndex is a no-op if the index already exists.
    await collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "sessions_ttl" },
    );
    return collection;
  });

  return collectionPromise;
}

export function createMongoSessionBackend(): SessionStorageBackend {
  return {
    async get(sessionId: string): Promise<string | null> {
      const col = await getCollection();
      const doc = await col.findOne({ _id: sessionId });
      if (!doc) return null;
      // Defensive expiry check — the TTL reaper runs at most once a minute,
      // so a freshly-expired row may briefly survive between sweeps.
      if (doc.expiresAt.getTime() < Date.now()) return null;
      return doc.value;
    },

    async set(
      sessionId: string,
      value: string,
      ttlSeconds: number,
    ): Promise<void> {
      const col = await getCollection();
      await col.updateOne(
        { _id: sessionId },
        {
          $set: {
            value,
            expiresAt: new Date(Date.now() + ttlSeconds * 1000),
          },
        },
        { upsert: true },
      );
    },

    async delete(sessionId: string): Promise<void> {
      const col = await getCollection();
      await col.deleteOne({ _id: sessionId });
    },
  };
}
