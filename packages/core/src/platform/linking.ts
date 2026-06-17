import { isDesktop } from "./index";

/**
 * Cross-platform URL opener for navigation that leaves the React tree —
 * external URLs (mailto, payment provider, billing portal), authoritative
 * redirects (post-logout, post-checkout success), or invoice downloads.
 *
 * Platform behavior:
 *   - **Web**: `window.location.href = url` (or `window.open(url, "_blank")`
 *     for `newTab`). External and internal URLs both navigate the page.
 *   - **Desktop (Tauri)**: EXTERNAL urls (`http(s):`, `mailto:`, `tel:`) open
 *     in the system browser / mail client via `@tauri-apps/plugin-opener` so
 *     they never navigate the app's own webview AWAY from Meridian — the
 *     industry-standard desktop behavior (cf. Electron `shell.openExternal`).
 *     INTERNAL routes (relative `/...`) fall through to the web path and stay
 *     in-webview. Handled inline (gated on `isDesktop()` + dynamic import,
 *     like `notifications.ts` / `updater.ts`) because the desktop build ships
 *     the same web bundle — there is no `.desktop.ts` resolution step.
 *   - **React Native** (sibling `linking.native.ts`, picked up by Metro):
 *     `Linking.openURL(url)` — always the system handler, `newTab` ignored.
 *
 * NOT for internal route changes. Use TanStack Router (`useNavigate` /
 * `<Link>`) for that — `openURL` triggers a real navigation, which loses
 * SPA state and triggers a fresh boot.
 */
export interface OpenURLOptions {
  /**
   * Web: open in a new tab with `noopener,noreferrer`. Native / desktop
   * (external): ignored — URLs always open in the system handler.
   */
  newTab?: boolean;
}

/**
 * URLs that must leave the app: schemes the desktop opener is permitted to
 * hand to the OS (`opener:default` grants exactly `http(s):` / `mailto:` /
 * `tel:`). Relative app routes (`/settings/...`) are intentionally NOT
 * external — they stay in the webview as in-app SPA navigation.
 */
function isExternalURL(url: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(url);
}

export function openURL(url: string, opts: OpenURLOptions = {}): void {
  if (typeof window === "undefined") return;

  // Desktop: route external links to the system browser/handler instead of
  // hijacking the app window. Fire-and-forget — the dynamic import keeps the
  // Tauri plugin out of the web bundle (code-split into a desktop-only chunk),
  // mirroring the best-effort contract of the web/native siblings.
  if (isDesktop() && isExternalURL(url)) {
    void import("@tauri-apps/plugin-opener")
      .then(({ openUrl }) => openUrl(url))
      .catch((e) => {
        console.error("[meridian:linking] openUrl failed:", e);
      });
    return;
  }

  if (opts.newTab) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.href = url;
}
