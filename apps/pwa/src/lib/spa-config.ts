import type { StageholderSpaConfig } from "@stageholder/sdk/spa";
import { ConfigError } from "@stageholder/sdk/spa";
import { createTauriStoreStorage, isTauri } from "@stageholder/sdk/tauri";

function readEnv(key: string): string {
  const value = import.meta.env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ConfigError(
      `Missing required env var ${key}. Set it in apps/pwa/.env.local.`,
    );
  }
  return value;
}

const issuerUrl = readEnv("VITE_IDENTITY_ISSUER_URL");
const clientId = readEnv("VITE_IDENTITY_CLIENT_ID");
const appUrl = readEnv("VITE_PUBLIC_APP_URL");

// On desktop, the OIDC flow runs INSIDE the Tauri webview — clicking
// sign-in navigates the webview itself to Hub's login page, the user
// authenticates, Hub redirects back to `${origin}/auth/callback?code=...`,
// and the SDK provider's cold-start completes the exchange.
//
// `window.location.origin` matches whatever URL the webview was loaded
// from — `http://localhost:4001` in dev (vite) and the Tauri custom
// protocol in prod (`tauri://localhost` on macOS/Linux,
// `http://tauri.localhost` on Windows). All three must be registered as
// redirect_uris on the meridian-web OIDC client at Hub.
//
// (Meridian uses first-party auth only — Hub's email/password. Federated
// IdPs that refuse embedded webviews aren't in scope for desktop, so the
// older loopback-server + system-browser dance was unnecessary and gave
// a jarring out-of-app UX.)
const redirectOrigin = isTauri() ? window.location.origin : appUrl;

// On desktop, persist session via tauri-plugin-store so tokens survive
// `clear_all_browsing_data()` at every Tauri cold boot (`src-tauri/src/lib.rs`).
// On web, the SDK's default LocalStorageAdapter applies — no storage option.
//
// File name (`auth.dat`) and key prefix (`sdk:`) are preserved from the
// hand-rolled adapter this replaced so existing desktop installs keep
// their session across the SDK swap. See the SDK's
// `docs/superpowers/plans/2026-05-16-sdk-tauri-storage-helper.md` for the
// helper's contract.
export const spaConfig: StageholderSpaConfig = {
  issuerUrl,
  clientId,
  redirectUri: `${redirectOrigin}/auth/callback`,
  postLogoutRedirectUri: `${redirectOrigin}/goodbye`,
  ...(isTauri()
    ? {
        storage: createTauriStoreStorage({
          storeFile: "auth.dat",
          keyPrefix: "sdk:",
        }),
      }
    : {}),
};
