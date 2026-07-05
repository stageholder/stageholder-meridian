import { useRef, useEffect, useCallback, useState } from "react";
import { useCreateJournal, useUpdateJournal } from "@/lib/api/journals";
import type { JournalContent } from "@repo/core/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface AutosaveData {
  title: string;
  // Legacy entries are HTML strings, new ones are TipTap JSON objects — the
  // editor emits JournalContent (string | object); store/forward as-is.
  content: JournalContent;
  mood?: number;
  tags: string[];
  date: string;
}

interface UseAutosaveOptions {
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
  // Set when a save is requested while another is in flight — the in-flight
  // save re-runs on completion so the newest edit is never dropped.
  const pendingRef = useRef(false);
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
    // A save is already in flight — don't drop this edit. The newest data is
    // in latestDataRef; flag it so the in-flight save re-runs on completion.
    if (isSavingRef.current) {
      pendingRef.current = true;
      return;
    }
    isSavingRef.current = true;
    pendingRef.current = false;
    setStatus("saving");

    try {
      const id = journalIdRef.current;
      if (id) {
        await updateRef.current.mutateAsync({
          id,
          data: {
            title: data.title,
            content: data.content,
            mood: data.mood,
            tags: data.tags,
          },
        });
      } else {
        const created = await createRef.current.mutateAsync({
          title:
            data.title ||
            new Date().toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            }),
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
      // Edits arrived during the save (or were coalesced away) — persist the
      // newest so nothing typed mid-save is lost.
      if (pendingRef.current && latestDataRef.current) {
        pendingRef.current = false;
        void doSave(latestDataRef.current);
      }
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
          doSave(latestDataRef.current);
        }
      }, debounceMs);
    },
    [doSave, debounceMs],
  );

  // Flush on unmount — unconditionally. If a save is in flight, doSave flags
  // pendingRef and the in-flight save re-runs with the newest data; if not, it
  // saves immediately. Gating on !isSavingRef (the old behavior) dropped the
  // newest edit whenever the user navigated away mid-save.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (latestDataRef.current) {
        void doSave(latestDataRef.current);
      }
    };
  }, [doSave]);

  return { scheduleSave, status, journalId };
}
