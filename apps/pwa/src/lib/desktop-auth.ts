import { isTauri } from "@stageholder/sdk/tauri";

/**
 * Desktop sign-in through the SYSTEM browser (RFC 8252, "OAuth 2.0 for Native
 * Apps") — the Slack / Linear / Figma pattern:
 *
 *   1. "Sign in" opens the Hub authorize URL in the user's default browser
 *      (passkeys, Touch ID, password managers and an existing Hub session all
 *      work there; an embedded webview gets none of them).
 *   2. Hub redirects to `meridian://auth/callback?code=…&state=…`; macOS hands
 *      that deep link to the running app (`tauri-plugin-deep-link`).
 *   3. We reload the webview onto `/auth/callback?code=…&state=…`, and the SDK
 *      provider's cold-start finishes the PKCE exchange exactly as on web —
 *      the PKCE record survives the reload in the Tauri store (`spa-config`).
 *
 * Only PACKAGED builds use it: an unbundled `tauri dev` binary is not
 * registered with LaunchServices, so macOS can't route the deep link to it.
 * `tauri dev` keeps the in-webview flow against the dev server origin.
 */
export const usesSystemBrowserAuth = isTauri() && !import.meta.env.DEV;

/** `meridian` in release builds; `meridian-dev` for the `.dev` bundle so the two can coexist. */
const urlScheme = import.meta.env.VITE_DESKTOP_URL_SCHEME || "meridian";

/** Registered as a redirect URI on the Hub's native `meridian-desktop` client. */
export const desktopRedirectUri = `${urlScheme}://auth/callback`;

/**
 * `StageholderSpaConfig.navigate` for desktop: the Hub authorize and
 * end-session URLs open in the system browser instead of this webview.
 *
 * After a sign-out the SDK has already revoked the refresh token and cleared
 * storage; reloading onto the sign-in screen drops every bit of in-memory
 * state (query cache, journal key) the way the web flow's full-page
 * navigation to the Hub does.
 */
export async function desktopNavigate(
  url: string,
  intent: "sign-in" | "sign-out",
): Promise<void> {
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
  if (intent === "sign-out") window.location.replace("/auth/login");
}

// Only the FIRST callback of a sign-in may run, keyed by its OAuth `state`
// (one pending sign-in = one state):
//  - the Hub can redirect the browser twice for one login, handing us two
//    deep links with different codes but the same state; the second would
//    abort the first reload mid-flight and race it;
//  - `getCurrent()` keeps returning the URL that launched the app for the
//    whole process lifetime, including after our own reload onto
//    /auth/callback, and must not replay its one-time code.
// Persisted per window session (survives our reload, not an app restart).
const HANDLED_KEY = "meridian:desktop-auth:handled-states";

function claimState(state: string): boolean {
  try {
    const handled: string[] = JSON.parse(
      sessionStorage.getItem(HANDLED_KEY) ?? "[]",
    );
    if (handled.includes(state)) return false;
    sessionStorage.setItem(
      HANDLED_KEY,
      JSON.stringify([...handled, state].slice(-10)),
    );
  } catch {
    // Storage unavailable — fall through; the SDK still rejects a replayed
    // code (exchange error), it just can't be skipped up front.
  }
  return true;
}

function consumeAuthCallback(urls: string[] | null | undefined): void {
  const url = urls?.find((u) => u.startsWith(`${desktopRedirectUri}?`));
  if (!url) return;
  const query = url.slice(desktopRedirectUri.length);
  const state = new URLSearchParams(query).get("state");
  if (!state || !claimState(state)) return;
  window.location.replace(`/auth/callback${query}`);
}

/** Start listening for `meridian://auth/callback` deep links. Call once at boot. */
export function initDesktopAuthDeepLinks(): void {
  if (!usesSystemBrowserAuth) return;
  void import("@tauri-apps/plugin-deep-link")
    .then(async ({ getCurrent, onOpenUrl }) => {
      await onOpenUrl(consumeAuthCallback);
      // Cold start: the deep link itself launched the app.
      consumeAuthCallback(await getCurrent());
    })
    .catch((err) => {
      console.error("[meridian:auth] deep-link listener failed:", err);
    });
}
