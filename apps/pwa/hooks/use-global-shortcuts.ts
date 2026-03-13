"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ShortcutCallbacks {
  setCommandPaletteOpen: (open: boolean) => void;
  setShortcutsDialogOpen: (open: boolean) => void;
  setCreateTodoDialogOpen: (open: boolean) => void;
}

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useGlobalShortcuts(
  shortId: string,
  callbacks: ShortcutCallbacks,
) {
  const router = useRouter();
  const pendingKeyRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const clearPending = useCallback(() => {
    pendingKeyRef.current = null;
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = isMac() ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      // Cmd/Ctrl+K — always active, even in inputs
      if (mod && key === "k") {
        e.preventDefault();
        callbacksRef.current.setCommandPaletteOpen(true);
        clearPending();
        return;
      }

      // All other shortcuts are blocked when focus is in an input
      if (isInputFocused()) return;

      // Check for chord completions (G → X)
      if (pendingKeyRef.current === "g") {
        clearPending();
        const navMap: Record<string, string> = {
          d: "dashboard",
          c: "calendar",
          t: "todos",
          h: "habits",
          j: "journal",
          s: "settings",
        };
        const dest = navMap[key];
        if (dest) {
          e.preventDefault();
          router.push(`/${shortId}/${dest}`);
          return;
        }
      }

      // Start chord with G
      if (key === "g" && !mod && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        pendingKeyRef.current = "g";
        pendingTimerRef.current = setTimeout(clearPending, 500);
        return;
      }

      // Single key shortcuts (no modifier keys except shift)
      if (!mod && !e.altKey) {
        // ? — shortcuts dialog
        if (e.key === "?") {
          e.preventDefault();
          callbacksRef.current.setShortcutsDialogOpen(true);
          return;
        }

        // Shift+N — open create todo dialog (check before N)
        if (key === "n" && e.shiftKey) {
          e.preventDefault();
          callbacksRef.current.setCreateTodoDialogOpen(true);
          return;
        }

        // N — navigate to todos page for quick add
        if (key === "n" && !e.shiftKey) {
          e.preventDefault();
          // Navigate to todos, then dispatch event after navigation settles
          const onTodosPage = window.location.pathname.includes(
            `/${shortId}/todos`,
          );
          if (onTodosPage) {
            window.dispatchEvent(new CustomEvent("meridian:quick-add-todo"));
          } else {
            router.push(`/${shortId}/todos`);
            // Dispatch after a short delay to let the page mount
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("meridian:quick-add-todo"));
            }, 300);
          }
          return;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearPending();
    };
  }, [shortId, router, clearPending]);
}
