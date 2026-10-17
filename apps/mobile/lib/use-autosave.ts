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
import { AppState } from "react-native";
import { toast } from "@stageholder/ui";
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
  // The running save loop, so `flush()` can await it.
  const inflightRef = useRef<Promise<void> | null>(null);
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
  const doSave = useCallback((data: AutosaveData): Promise<void> => {
    if (isSavingRef.current) {
      pendingDataRef.current = data;
      return inflightRef.current ?? Promise.resolve();
    }
    isSavingRef.current = true;
    const run = runSaveLoop(data);
    inflightRef.current = run;
    return run;
  }, []); // stable — no deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const runSaveLoop = async (data: AutosaveData) => {
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
      inflightRef.current = null;
    }
  };

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

  /** Persist everything typed so far, NOW. Resolves `true` once the newest
   *  data is on the server (or there was nothing to save), `false` if the
   *  write failed — "Done" awaits this instead of navigating away from an
   *  unsaved draft. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const latest = latestDataRef.current;
    if (latest && latest !== savedDataRef.current) await doSave(latest);
    // A save may still be draining a queued edit.
    while (inflightRef.current) await inflightRef.current;
    return latestDataRef.current === savedDataRef.current;
  }, [doSave]);

  /** Abandon the draft: cancel pending/queued saves (so the unmount flush
   *  can't re-save it), wait out a save already on the wire, and return the
   *  entry id it ended up with (null if it was never created) for deletion. */
  const discard = useCallback(async (): Promise<string | null> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    latestDataRef.current = null;
    pendingDataRef.current = null;
    while (inflightRef.current) await inflightRef.current;
    latestDataRef.current = null;
    return journalIdRef.current;
  }, []);

  /** True when there's typed data the server hasn't confirmed yet. */
  const hasUnsaved = useCallback(
    () =>
      !!latestDataRef.current && latestDataRef.current !== savedDataRef.current,
    [],
  );

  // Backgrounding is the last reliable moment before the OS may kill the
  // app — don't let the last second of typing ride on the debounce timer.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") void flush();
    });
    return () => sub.remove();
  }, [flush]);

  // Flush on unmount — UNCONDITIONALLY (C3): back-swipe / hardware Back leave
  // without pressing Done. If that final write fails the screen is already
  // gone, so surface it as a toast instead of losing the text silently.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (
        latestDataRef.current &&
        latestDataRef.current !== savedDataRef.current
      ) {
        const latest = latestDataRef.current;
        void doSave(latest).then(() => {
          if (savedDataRef.current !== latest) {
            toast.error("Your last journal changes weren't saved", {
              description: "Check your connection, then reopen the entry.",
            });
          }
        });
      }
    };
  }, [doSave]);

  return { scheduleSave, flush, discard, hasUnsaved, status, journalId };
}
