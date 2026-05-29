// Use the cross-platform DataStore adapter for sync — same code path will
// power the future RN mobile app with a SQLite-backed adapter. PWA files that
// need Dexie-specific power (compound indexes, liveQuery, etc.) keep
// importing the raw `db` from "@repo/offline/db" directly.
import { dataStore as db } from "@repo/offline/db/adapter";
import { fullSync, type SyncConflict } from "@repo/offline/sync/sync-manager";
import { sendNativeNotification } from "@repo/core/platform/notifications";
import { logger } from "@repo/core/platform/logger";
import apiClient from "@/lib/api-client";
import {
  todosApi,
  journalsApi,
  habitsApi,
  tagsApi,
  notificationsApi,
} from "@/lib/api/clients";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import { decryptJournalList } from "@/lib/crypto/journal-crypto";
import { registerJournalEncryptionTransform } from "@/lib/crypto/register-transforms";
import { tryGetCurrentUserSub } from "@/lib/current-user-sub";
import { refreshEntitlement } from "@/lib/entitlement";

// Register encryption transform for offline journal mutations
registerJournalEncryptionTransform();

let onConflicts: ((conflicts: SyncConflict[]) => void) | null = null;

export function setConflictHandler(
  handler: (conflicts: SyncConflict[]) => void,
) {
  onConflicts = handler;
}

function buildParams(since?: string): Record<string, string> | undefined {
  if (!since) return undefined;
  return { updatedSince: since, includeSoftDeleted: "true" };
}

/**
 * Flatten the results of a `Promise.allSettled` over a fan-out fetch
 * (one request per parent — list, habit, etc.). Successful sub-fetches
 * always survive; a single failed sub-fetch is logged with the
 * supplied label and dropped. Without this, a 5xx on one parent would
 * `Promise.all`-reject the whole sync step and discard every successful
 * sibling.
 */
function settledFlat<T>(
  results: PromiseSettledResult<T[]>[],
  label: (index: number) => string,
): T[] {
  const out: T[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (r.status === "fulfilled") {
      out.push(...r.value);
      continue;
    }
    const message =
      r.reason instanceof Error ? r.reason.message : String(r.reason);
    logger.warn(`[Sync] ${label(i)} failed: ${message}`);
  }
  return out;
}

export async function syncAll(): Promise<void> {
  // Sync is user-scoped now — bail out if the session hasn't resolved yet.
  const userSub = tryGetCurrentUserSub();
  if (!userSub) return;

  const fetchers = {
    todoLists: (since?: string) => todosApi.listLists(buildParams(since)),
    todos: async (since?: string) => {
      if (since) {
        // Delta sync: fetch all updated todos directly
        return todosApi.listAllTodos({ ...buildParams(since), limit: 1000 });
      }
      const lists = await todosApi.listLists();
      return settledFlat(
        await Promise.allSettled(
          lists.map((list) => todosApi.listTodos(list.id)),
        ),
        (i) => `todos for list ${lists[i]?.id ?? "?"}`,
      );
    },
    journals: async (since?: string) => {
      const { isSetup, isUnlocked, dek } = useEncryptionStore.getState();
      // Skip journal sync when encryption is set up but locked
      if (isSetup && !isUnlocked) return [];
      const journals = await journalsApi.list(buildParams(since));
      if (dek) return decryptJournalList(journals, dek);
      return journals;
    },
    habits: (since?: string) => habitsApi.list(buildParams(since)),
    habitEntries: async (since?: string) => {
      if (since) {
        return habitsApi.listAllEntries({ ...buildParams(since), limit: 1000 });
      }
      const habits = await habitsApi.list();
      return settledFlat(
        await Promise.allSettled(
          habits.map((habit) => habitsApi.listEntries(habit.id)),
        ),
        (i) => `habit entries for ${habits[i]?.id ?? "?"}`,
      );
    },
    tags: (since?: string) => tagsApi.list(buildParams(since)),
    notifications: async (since?: string) => {
      const result = await notificationsApi.list({
        limit: 100,
        ...buildParams(since),
      });
      return result.data;
    },
  };

  const tables = {
    todoLists: db.todoLists,
    todos: db.todos,
    journals: db.journals,
    habits: db.habits,
    habitEntries: db.habitEntries,
    tags: db.tags,
    notifications: db.notifications,
  };

  try {
    const conflicts = await fullSync(
      userSub,
      apiClient,
      fetchers as Record<string, (since?: string) => Promise<{ id: string }[]>>,
      // Cast widens the per-entity store unions to fullSync's generic
      // `EntityStore<SyncableEntity>`. EntityStore is invariant in T (T appears
      // in put/update inputs), so the precise per-entity types don't auto-widen;
      // the runtime types are fine because each store only handles its own row.
      tables as never,
    );

    if (conflicts.length > 0 && onConflicts) {
      onConflicts(conflicts);
    }

    // Refresh the entitlement cache after a successful sync. This runs
    // outside packages/offline because that package can't import from
    // apps/pwa. Failures here shouldn't abort the sync.
    await refreshEntitlement(userSub);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : "";
    logger.error(`[Sync] Failed: ${message}\n${stack ?? ""}`);
    sendNativeNotification("Sync failed", message);
    throw error;
  }
}
