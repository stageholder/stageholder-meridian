// apps/mobile/lib/stores/todos.ts
//
// Zustand store for todos. Persisted to AsyncStorage via the persist
// middleware so a list survives app restarts. Writes are O(1); the
// derived selectors (today / upcoming / done) live in the components so
// the store stays a thin data layer.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { dateKey, type Priority, type Todo } from "@/lib/types";
import { SEED_TODOS } from "@/lib/seed-data";

type TodoInput = {
  title: string;
  notes?: string;
  priority?: Priority;
  dueDate?: string;
};

type TodoStore = {
  todos: Todo[];
  add: (input: TodoInput) => Todo;
  toggle: (id: string) => void;
  update: (id: string, patch: Partial<TodoInput>) => void;
  remove: (id: string) => void;
  /** Used by Today dashboard to count "done today". */
  countDoneOn: (key: string) => number;
  countAllOn: (key: string) => number;
};

export const useTodos = create<TodoStore>()(
  persist(
    (set, get) => ({
      todos: SEED_TODOS,

      add: (input) => {
        const now = new Date().toISOString();
        const todo: Todo = {
          id: makeId(),
          title: input.title.trim(),
          notes: input.notes?.trim() || undefined,
          priority: input.priority ?? "normal",
          dueDate: input.dueDate,
          createdAt: now,
        };
        set({ todos: [todo, ...get().todos] });
        return todo;
      },

      toggle: (id) =>
        set({
          todos: get().todos.map((t) =>
            t.id === id
              ? {
                  ...t,
                  completedAt: t.completedAt
                    ? undefined
                    : new Date().toISOString(),
                }
              : t,
          ),
        }),

      update: (id, patch) =>
        set({
          todos: get().todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }),

      remove: (id) => set({ todos: get().todos.filter((t) => t.id !== id) }),

      countDoneOn: (key) => {
        const target = key;
        return get().todos.filter((t) => {
          if (!t.completedAt) return false;
          return dateKey(new Date(t.completedAt)) === target;
        }).length;
      },

      countAllOn: (key) => {
        const target = key;
        return get().todos.filter((t) => {
          // "All for today" means: due today, OR completed today, OR no
          // due date but created today. Captures the natural mental model
          // of "what does today look like".
          if (t.dueDate === target) return true;
          if (t.completedAt && dateKey(new Date(t.completedAt)) === target)
            return true;
          if (!t.dueDate && dateKey(new Date(t.createdAt)) === target)
            return true;
          return false;
        }).length;
      },
    }),
    {
      name: "meridian.todos.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

function makeId(): string {
  return `t_${Math.random().toString(36).slice(2, 10)}`;
}
