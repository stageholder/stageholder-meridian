/**
 * Bridge between React lifecycle and the inline splash in `index.html`.
 *
 * The splash runs entirely from a `<script>` tag below the React mount
 * point — it owns its DOM, runs its own RAF crawl, and tears itself down
 * on `meridian:ready`. React just dispatches checkpoint events so the
 * crawl can bump its target and the user sees real progress instead of
 * a fake animation.
 *
 * Ported from stageholder-almanac's identical helper. Event names are
 * namespaced per-product so two SPA shells on the same page (PWA + Tauri
 * webview hosting both) don't accidentally signal each other's splashes.
 */

const PROGRESS_EVENT = "meridian:progress";
const READY_EVENT = "meridian:ready";

interface ProgressDetail {
  value?: number;
  label?: string;
}

/**
 * Bump the splash's target percent and (optionally) swap its phase label.
 * Safe to call from any module; the splash listens passively.
 *
 * Called at meaningful checkpoints (script entry, React mount, SDK
 * `useUser` resolution, post-onboarding meta fetch). The splash's RAF
 * loop interpolates toward whatever the latest `value` was, so calling
 * this with `value: 84` doesn't snap — it accelerates the crawl.
 */
export function dispatchLoadingProgress(value: number, label?: string): void {
  if (typeof window === "undefined") return;
  const detail: ProgressDetail = { value, ...(label ? { label } : {}) };
  window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail }));
}

let readyDispatched = false;

/**
 * Signal "everything that matters is on screen". The splash jumps to 100%,
 * holds for 220 ms (lets the user notice completion), fades out over 520
 * ms, then removes itself from the DOM.
 *
 * Idempotent — extra calls after the first are no-ops. Safe to wire as a
 * dependency-array effect that may fire on re-render.
 */
export function dispatchLoadingReady(): void {
  if (typeof window === "undefined" || readyDispatched) return;
  readyDispatched = true;
  window.dispatchEvent(new Event(READY_EVENT));
}
