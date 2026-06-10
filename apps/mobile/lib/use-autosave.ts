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
  const latestDataRef = useRef<AutosaveData | null>(null);
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

  // doSave has NO reactive dependencies — uses refs only
  const doSave = useCallback(async (data: AutosaveData) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setStatus("saving");

    try {
      const id = journalIdRef.current;
      if (id) {
        // Unlike the PWA (whose edit route pins the date), mobile's edit
        // screen has a date chip — include it so date changes persist.
        await updateRef.current.mutateAsync({
          id,
          patch: {
            title: data.title,
            content: data.content,
            mood: data.mood,
            tags: data.tags,
            date: data.date,
          },
        });
      } else {
        // useCreateJournal defaults title (date label) and date (today)
        // itself, but pass what we have so the entry matches the screen.
        const created = await createRef.current.mutateAsync({
          title: data.title,
          content: data.content,
          mood: data.mood,
          tags: data.tags,
          date: data.date,
        });
        setJournalId(created.id);
        journalIdRef.current = created.id;
        onCreatedRef.current?.(created.id);
      }
      setStatus("saved");
    } catch {
      setStatus("error");
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

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (latestDataRef.current && !isSavingRef.current) {
          void doSave(latestDataRef.current);
        }
      }
    };
  }, [doSave]);

  return { scheduleSave, status, journalId };
}
