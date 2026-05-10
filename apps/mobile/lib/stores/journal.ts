// apps/mobile/lib/stores/journal.ts
//
// Zustand store for journal entries. Multiple entries per day are allowed
// (matches the PWA model). Word counts are computed on read so we don't
// have to rebalance the store on every keystroke.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { countWords, dateKey, type JournalEntry, type Mood } from "@/lib/types";
import { SEED_JOURNAL } from "@/lib/seed-data";

type EntryInput = {
  dateKey?: string;
  body?: string;
  mood?: Mood;
  tags?: string[];
};

type JournalStore = {
  entries: JournalEntry[];
  /** Daily word target for the "you hit your goal" celebration. */
  dailyTarget: number;
  setDailyTarget: (n: number) => void;

  add: (input: EntryInput) => JournalEntry;
  update: (id: string, patch: Partial<EntryInput>) => void;
  remove: (id: string) => void;

  entriesFor: (key: string) => JournalEntry[];
  wordsOn: (key: string) => number;
};

export const useJournal = create<JournalStore>()(
  persist(
    (set, get) => ({
      entries: SEED_JOURNAL,
      dailyTarget: 200,

      setDailyTarget: (n) => set({ dailyTarget: Math.max(0, n) }),

      add: (input) => {
        const now = new Date().toISOString();
        const entry: JournalEntry = {
          id: makeId(),
          dateKey: input.dateKey ?? dateKey(),
          body: input.body ?? "",
          mood: input.mood,
          tags: input.tags ?? [],
          createdAt: now,
          updatedAt: now,
        };
        set({ entries: [entry, ...get().entries] });
        return entry;
      },

      update: (id, patch) =>
        set({
          entries: get().entries.map((e) =>
            e.id === id
              ? { ...e, ...patch, updatedAt: new Date().toISOString() }
              : e,
          ),
        }),

      remove: (id) =>
        set({ entries: get().entries.filter((e) => e.id !== id) }),

      entriesFor: (key) =>
        get()
          .entries.filter((e) => e.dateKey === key)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),

      wordsOn: (key) =>
        get()
          .entries.filter((e) => e.dateKey === key)
          .reduce((sum, e) => sum + countWords(e.body), 0),
    }),
    {
      name: "meridian.journal.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

function makeId(): string {
  return `j_${Math.random().toString(36).slice(2, 10)}`;
}
