import { Injectable, Logger } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";

/**
 * Migrates legacy (pre-Hub) user data to be addressable by the Hub-issued
 * OIDC `sub`. Runs once per user on first login: when `UserService` creates
 * a fresh row under a new `sub`, this service looks up the legacy row by
 * email and rewires every related document.
 *
 * Pre-Hub schema kept data scoped by:
 *   - `creator_id` / `author_id` / `user_id` → the local users._id
 *   - `workspace_id` → the personal workspace id
 *   - `users.encrypted_dek` / `dek_salt` / `encryption_enabled` (inline)
 *
 * Hub schema scopes everything by:
 *   - `userSub` (Hub OIDC sub) on every product collection
 *   - `journal_security` keyed by `_id = userSub`
 *
 * Idempotent: every step filters on "missing userSub" / "no existing
 * journal_security" / "empty auto-provisioned default Inbox". Re-running
 * is safe and a no-op once a user is migrated.
 *
 * Best-effort: a failure inside this method must NOT block first-login
 * provisioning. Callers wrap in try/catch and log.
 */
@Injectable()
export class LegacyMigrationService {
  private readonly logger = new Logger(LegacyMigrationService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async migrateIfLegacy(sub: string, email: string | null): Promise<void> {
    if (!email) return;
    const db = this.connection.db;
    if (!db) return;

    const oldUser = await db.collection("users").findOne({
      email,
      sub: { $exists: false },
    });
    if (!oldUser) return;

    const OLD_ID = oldUser._id as unknown as string;
    const ws = await db.collection("workspaces").findOne({
      owner_id: OLD_ID,
      is_personal: true,
      deleted_at: null,
    });
    const WORKSPACE_ID = ws?._id as unknown as string | undefined;

    const missingUserSub = {
      $or: [{ userSub: null }, { userSub: { $exists: false } }],
    };

    const ownerScoped: Array<{ col: string; ownerField: string }> = [
      { col: "habits", ownerField: "creator_id" },
      { col: "todo_lists", ownerField: "creator_id" },
      { col: "todos", ownerField: "creator_id" },
      { col: "journals", ownerField: "author_id" },
      { col: "light_events", ownerField: "user_id" },
    ];
    let totalDocs = 0;
    for (const { col, ownerField } of ownerScoped) {
      const r = await db
        .collection(col)
        .updateMany(
          { [ownerField]: OLD_ID, ...missingUserSub },
          { $set: { userSub: sub } },
        );
      totalDocs += r.modifiedCount;
    }

    if (WORKSPACE_ID) {
      const workspaceScoped = [
        "habit_entries",
        "notifications",
        "tags",
        "activities",
      ];
      for (const col of workspaceScoped) {
        const r = await db
          .collection(col)
          .updateMany(
            { workspace_id: WORKSPACE_ID, ...missingUserSub },
            { $set: { userSub: sub } },
          );
        totalDocs += r.modifiedCount;
      }
    }

    // Re-key user_lights: legacy row lives under `user_id`; the LightService
    // auto-provisions an empty row under the new `userSub` on first access
    // (and may do so concurrently with this migration on a hot first login).
    // Drop any empty placeholder at this userSub, then move the legacy row
    // onto sub. Empty (`total_light: 0`) is the placeholder signature — a
    // non-zero row at this userSub cannot exist on first-user-record-insert,
    // so leaving it alone is the safe fallback.
    const oldLight = await db
      .collection("user_lights")
      .findOne({ user_id: OLD_ID });
    if (oldLight) {
      await db
        .collection("user_lights")
        .deleteMany({ userSub: sub, total_light: 0 });
      await db
        .collection("user_lights")
        .updateOne({ _id: oldLight._id }, { $set: { userSub: sub } });
    }

    // Journal security: pre-Hub stored DEK/salt inline on the user doc.
    // Recovery codes can not be carried over (single legacy hash vs new
    // per-code wrapped DEK + Argon2 hash array) — flag recovery exhausted.
    if (
      oldUser.encryption_enabled === true &&
      oldUser.encrypted_dek &&
      oldUser.dek_salt
    ) {
      const existing = await db
        .collection("journal_security")
        .findOne({ _id: sub });
      if (!existing) {
        const now = new Date();
        await db.collection("journal_security").insertOne({
          _id: sub,
          encryptionEnabled: true,
          passphraseWrappedDek: oldUser.encrypted_dek,
          passphraseSalt: oldUser.dek_salt,
          recoveryWrappedDek: "",
          recoveryCodeHashes: [],
          recoveryCodesRemaining: 0,
          createdAt: now,
          updatedAt: now,
          __v: 0,
        });
      }
    }

    // Dedupe default Inbox: keep the oldest is_default list (the legacy one
    // we just adopted) and delete any newer empty defaults that the API
    // auto-created during the JIT first-login window.
    const defaults = await db
      .collection("todo_lists")
      .find({ userSub: sub, deleted_at: null, is_default: true })
      .sort({ created_at: 1 })
      .toArray();
    if (defaults.length > 1) {
      for (let i = 1; i < defaults.length; i++) {
        const d = defaults[i]!;
        const todoCount = await db.collection("todos").countDocuments({
          list_id: d._id,
          userSub: sub,
          deleted_at: null,
        });
        if (todoCount === 0) {
          await db.collection("todo_lists").deleteOne({ _id: d._id });
        }
      }
    }

    this.logger.log(
      `Legacy migration complete for ${email} → sub ${sub}: ${totalDocs} docs rekeyed`,
    );
  }
}
