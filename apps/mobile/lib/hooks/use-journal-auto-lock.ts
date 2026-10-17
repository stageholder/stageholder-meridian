// apps/mobile/lib/hooks/use-journal-auto-lock.ts
//
// Re-lock the journal after the app has sat in the background for a while.
// Without this the DEK stayed in memory for the life of the process, so a
// phone left unlocked on a table kept the journal readable indefinitely.
//
// A grace period (not lock-on-every-background) keeps quick app switches —
// copying a link, answering a message — from demanding the passphrase again.

import { useEffect } from "react";
import { AppState } from "react-native";

import { getJournalDek, relockJournal } from "@/lib/journal-crypto";

/** How long the app may stay backgrounded before the journal re-locks. */
const GRACE_MS = 5 * 60 * 1000;

export function useJournalAutoLock(): void {
  useEffect(() => {
    let backgroundedAt: number | null = null;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgroundedAt = Date.now();
        return;
      }
      if (next !== "active" || backgroundedAt === null) return;
      const away = Date.now() - backgroundedAt;
      backgroundedAt = null;
      if (away < GRACE_MS || !getJournalDek()) return;
      // relockJournal() drops the DEK + decrypted caches but keeps this
      // account's "encryption is set up" state (see journal-crypto), so the
      // journal shows its unlock prompt and no write can slip out as
      // plaintext while the status would otherwise be re-resolving.
      relockJournal();
    });
    return () => sub.remove();
  }, []);
}
