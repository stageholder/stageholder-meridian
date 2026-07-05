// apps/mobile/lib/use-autosave.ts
//
// Debounced journal autosave — the mobile port of the PWA's
// apps/pwa/src/lib/hooks/use-autosave.ts. Same semantics: first save POSTs
// (create) and keeps the new id internally, every later save PATCHes. The
// mutations already own the encryption boundary (encrypt-before-POST/PATCH
// when a DEK is in memory), so this hook stays plaintext-agnostic.
//
// The web original's TanStack-Router caveat (no URL rewrite after the first
// save) doesn't apply here — expo-router never re-matches the route — but we
// keep the same "stay on the screen, remember the id internally" behavior
// because remounting journal/new into journal/[id] would blur the 10tap
// editor mid-typing all the same.

import { useRef, useEffect, useCallback, useState } from "react";
import type { JournalContent } from "@repo/core/types";

import { useCreateJournal, useUpdateJournal } from "@/lib/api";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface AutosaveData {
  title: string;
  // Dual-format: legacy entries are HTML strings, new ones TipTap JSON.
  content: JournalContent;
  mood?: number;
  tags: string[];
  date: string;
}

interface UseAutosaveOptions {
  /** Existing entry id (edit screen). Omit on the create screen. */
  journalId?: string | null;
  onCreated?: (id: string) => void;
  debounceMs?: number;
}

export function useAutosave({
  journalId: initialId,
  onCreated,
  debounceMs = 1000,
}: UseAutosaveOptions) {
  const [journalId, setJournalId] = useState<string | null>(initialId ?? null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const createJournal = useCreateJournal();
  const updateJournal = useUpdateJournal();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The newest data ever scheduled (what an unmount flush should persist).
  const latestDataRef = useRef<AutosaveData | null>(null);
  // Data that arrived WHILE a save was in flight — flushed as soon as that
  // save finishes so a trailing edit is never dropped (C3).
  const pendingDataRef = useRef<AutosaveData | null>(null);
  // The data of the last SUCCESSFULLY persisted save — lets the unmount flush
  // skip a redundant write when nothing changed since.
  const savedDataRef = useRef<AutosaveData | null>(null);
  const isSavingRef = useRef(false);
  const journalIdRef = useRef(journalId);
  const onCreatedRef = useRef(onCreated);
  const createRef = useRef(createJournal);
  const updateRef = useRef(updateJournal);

  // Keep refs in sync without causing re-renders
  onCreatedRef.current = onCreated;
  createRef.current = createJournal;
  updateRef.current = updateJournal;

  useEffect(() => {
    journalIdRef.current = journalId;
  }, [journalId]);

  useEffect(() => {
    if (initialId) {
      setJournalId(initialId);
      journalIdRef.current = initialId;
    }
  }, [initialId]);

  // doSave has NO reactive dependencies — uses refs only.
  //
  // Coalescing (C3): if a save is already in flight, we DON'T drop this call —
  // we stash the newest data as `pending` and let the running save re-run with
  // it when it finishes. The running save drains `pending` in a loop, so a
  // burst of edits during one network round-trip collapses to a single trailing
  // save with the latest data instead of being lost.
  const doSave = useCallback(async (data: AutosaveData) => {
    if (isSavingRef.current) {
      pendingDataRef.current = data;
      return;
    }
    isSavingRef.current = true;

    let current: AutosaveData | null = data;
    try {
      while (current) {
        // Anything queued during the previous iteration's await is now being
        // handled; clear it before the await so a fresh edit re-queues.
        pendingDataRef.current = null;
        setStatus("saving");
        try {
          const id = journalIdRef.current;
          if (id) {
            // Unlike the PWA (whose edit route pins the date), mobile's edit
            // screen has a date chip — include it so date changes persist.
            await updateRef.current.mutateAsync({
              id,
              patch: {
                title: current.title,
                content: current.content,
                mood: current.mood,
                tags: current.tags,
                date: current.date,
              },
            });
          } else {
            // useCreateJournal defaults title (date label) and date (today)
            // itself, but pass what we have so the entry matches the screen.
            const created = await createRef.current.mutateAsync({
              title: current.title,
              content: current.content,
              mood: current.mood,
              tags: current.tags,
              date: current.date,
            });
            setJournalId(created.id);
            journalIdRef.current = created.id;
            onCreatedRef.current?.(created.id);
          }
          savedDataRef.current = current;
          setStatus("saved");
        } catch {
          setStatus("error");
        }
        // Drain a trailing edit that arrived during the await. On error we stop
        // (nothing new queued) and leave savedDataRef behind the latest, so the
        // unmount flush / next schedule retries.
        current = pendingDataRef.current;
      }
    } finally {
      isSavingRef.current = false;
    }
  }, []); // stable — no deps

  // scheduleSave is also stable
  const scheduleSave = useCallback(
    (data: AutosaveData) => {
      latestDataRef.current = data;
      setStatus("idle");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (latestDataRef.current) {
          void doSave(latestDataRef.current);
        }
      }, debounceMs);
    },
    [doSave, debounceMs],
  );

  // Flush on unmount — UNCONDITIONALLY (C3). The old guard skipped the flush
  // while a save was in flight, dropping any edit typed after the debounce
  // fired. Now we always flush the newest un-persisted data: if a save is
  // running, doSave queues it as `pending` and the running save drains it.
  // Skip only when the newest data was already persisted (savedDataRef), to
  // avoid a no-op write.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (
        latestDataRef.current &&
        latestDataRef.current !== savedDataRef.current
      ) {
        void doSave(latestDataRef.current);
      }
    };
  }, [doSave]);

  return { scheduleSave, status, journalId };
}
