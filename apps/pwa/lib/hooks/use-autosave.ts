"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useCreateJournal, useUpdateJournal } from "@/lib/api/journals";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface AutosaveData {
  title: string;
  content: string;
  mood?: number;
  tags: string[];
  date: string;
}

interface UseAutosaveOptions {
  journalId?: string | null;
  onCreated?: (id: string) => void;
  debounceMs?: number;
}

export function useAutosave({ journalId: initialId, onCreated, debounceMs = 1000 }: UseAutosaveOptions) {
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
          title: data.title || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
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
  const scheduleSave = useCallback((data: AutosaveData) => {
    latestDataRef.current = data;
    setStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (latestDataRef.current) {
        doSave(latestDataRef.current);
      }
    }, debounceMs);
  }, [doSave, debounceMs]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (latestDataRef.current && !isSavingRef.current) {
          doSave(latestDataRef.current);
        }
      }
    };
  }, [doSave]);

  return { scheduleSave, status, journalId };
}
