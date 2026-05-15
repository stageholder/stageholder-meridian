import { useRef, useReducer, useEffect } from "react";
import type { Todo } from "@repo/core/types";

const EXIT_DURATION = 950; // ms — matches CSS todo-incinerate (0.3s delay + 0.6s anim + buffer)

interface ExitingEntry {
  todo: Todo;
  index: number;
}

/**
 * Wraps a filtered todo list so that items transitioning to "done"
 * stay visible long enough for the exit animation to play.
 *
 * Exiting items are detected synchronously during render so there is
 * never a frame where the item disappears before the animation starts.
 */
export function useAnimatedTodoList(pendingTodos: Todo[]) {
  const prevOrderRef = useRef<string[]>([]);
  const prevTodosRef = useRef<Map<string, Todo>>(new Map());
  const exitingRef = useRef<Map<string, ExitingEntry>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  // Force a re-render when an exiting item's timer expires
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // --- Synchronous diffing during render (no blink) ---
  const currentIds = new Set(pendingTodos.map((t) => t.id));

  for (const id of prevOrderRef.current) {
    if (
      !currentIds.has(id) &&
      !exitingRef.current.has(id) &&
      !timersRef.current.has(id)
    ) {
      const todo = prevTodosRef.current.get(id);
      if (todo) {
        const index = prevOrderRef.current.indexOf(id);
        exitingRef.current.set(id, {
          todo: { ...todo, status: "done" },
          index,
        });

        const timer = setTimeout(() => {
          exitingRef.current.delete(id);
          timersRef.current.delete(id);
          forceUpdate();
        }, EXIT_DURATION);
        timersRef.current.set(id, timer);
      }
    }
  }

  // Update refs for next render
  prevOrderRef.current = pendingTodos.map((t) => t.id);
  const todoMap = new Map<string, Todo>();
  for (const t of pendingTodos) {
    todoMap.set(t.id, t);
  }
  prevTodosRef.current = todoMap;

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  // Merge exiting items back into their original positions
  const completingIds = new Set(exitingRef.current.keys());
  const visibleTodos = [...pendingTodos];
  const sorted = Array.from(exitingRef.current.entries()).sort(
    ([, a], [, b]) => a.index - b.index,
  );
  for (const [, entry] of sorted) {
    const insertAt = Math.min(entry.index, visibleTodos.length);
    visibleTodos.splice(insertAt, 0, entry.todo);
  }

  return { visibleTodos, completingIds };
}
