/**
 * Cross-platform URL opener for navigation that leaves the React tree —
 * external URLs (mailto, payment provider, billing portal), authoritative
 * redirects (post-logout, post-checkout success), or invoice downloads.
 *
 * Web impl: `window.location.href = url` (or `window.open(url, "_blank")`).
 * Future native impls (sibling `.native.ts` modules picked up by Metro):
 *   - React Native: `Linking.openURL(url)` — always opens in the system
 *     browser / mail client, regardless of `newTab`.
 *   - Tauri: `shell.open(url)` for external URLs so they don't navigate
 *     the webview AWAY from the app.
 *
 * NOT for internal route changes. Use TanStack Router (`useNavigate` /
 * `<Link>`) for that — `openURL` triggers a real navigation, which loses
 * SPA state and triggers a fresh boot.
 */
export interface OpenURLOptions {
  /**
   * Web: open in a new tab with `noopener,noreferrer`. Native: ignored
   * (URLs always open in the system handler).
   */
  newTab?: boolean;
}

export function openURL(url: string, opts: OpenURLOptions = {}): void {
  if (typeof window === "undefined") return;
  if (opts.newTab) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.href = url;
}
