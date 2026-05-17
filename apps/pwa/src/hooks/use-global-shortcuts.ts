import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

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

export function useGlobalShortcuts(callbacks: ShortcutCallbacks) {
  const navigate = useNavigate();
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
      // Some browser-driven events (notably IME composition and certain
      // <datalist>/autofill interactions in Chromium) dispatch a KeyboardEvent
      // without `key` populated. Guard before accessing it.
      if (!e.key) return;
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

      // Cmd/Ctrl+[ — browser-style back; Cmd/Ctrl+] — forward.
      // Matches the header chevron buttons (desktop) and the macOS
      // convention. Forward is a no-op when there's no forward entry.
      if (mod && !e.shiftKey && !e.altKey) {
        if (e.key === "[") {
          e.preventDefault();
          window.history.back();
          return;
        }
        if (e.key === "]") {
          e.preventDefault();
          window.history.forward();
          return;
        }
      }

      // Check for chord completions (G → X)
      if (pendingKeyRef.current === "g") {
        clearPending();
        const navMap: Record<string, string> = {
          d: "/",
          c: "/calendar",
          t: "/todos",
          h: "/habits",
          j: "/journal",
          s: "/settings",
        };
        const dest = navMap[key];
        if (dest) {
          e.preventDefault();
          navigate({ to: dest });
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
          const onTodosPage =
            window.location.pathname === "/todos" ||
            window.location.pathname.startsWith("/todos/");
          if (onTodosPage) {
            window.dispatchEvent(new CustomEvent("meridian:quick-add-todo"));
          } else {
            navigate({ to: "/todos" });
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
  }, [navigate, clearPending]);
}
