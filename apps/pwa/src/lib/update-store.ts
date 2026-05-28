import { create } from "zustand";

/**
 * Cross-component bridge for the desktop updater. The actual check +
 * AlertDialog + auto-poll live inside the <UpdateChecker /> component
 * (so it can use the kit `useToast`/`AlertDialog` hooks). The menu item
 * in the app-shell fires a transient request through this store; the
 * component subscribes and runs the check, then clears the request.
 *
 * A store (not React context) keeps the call site simple — the menu
 * `onSelect` can be a plain function reference instead of a hook call.
 * Zustand is also cross-platform, so the same pattern ports to a React
 * Native shell unchanged.
 */
interface CheckRequest {
  /** Bumps on each new request so React effects re-fire even if opts repeat. */
  id: number;
  /**
   * When true, a "no update available" or failed-check result still
   * shows a toast (user-initiated). Auto-poll passes false to stay silent.
   */
  showWhenUpToDate: boolean;
}

interface UpdateStore {
  checkRequest: CheckRequest | null;
  requestCheck: (opts?: { showWhenUpToDate?: boolean }) => void;
  consumeRequest: () => void;
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  checkRequest: null,
  requestCheck: (opts = {}) =>
    set({
      checkRequest: {
        id: Date.now(),
        showWhenUpToDate: opts.showWhenUpToDate ?? false,
      },
    }),
  consumeRequest: () => set({ checkRequest: null }),
}));
