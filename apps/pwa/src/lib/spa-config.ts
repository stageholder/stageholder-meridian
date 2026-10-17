import type { StageholderSpaConfig } from "@stageholder/sdk/spa";
import { ConfigError } from "@stageholder/sdk/spa";
import { createTauriStoreStorage, isTauri } from "@stageholder/sdk/tauri";
import {
  desktopNavigate,
  desktopRedirectUri,
  usesSystemBrowserAuth,
} from "./desktop-auth";

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

// Packaged desktop builds sign in through the SYSTEM browser and come back on
// the `meridian://auth/callback` deep link (see `lib/desktop-auth.ts`). Their
// client id (`VITE_IDENTITY_CLIENT_ID` of the desktop build) is the Hub's
// native `meridian-desktop` client, which registers that deep link plus
// `${VITE_PUBLIC_APP_URL}/goodbye` — the post-logout page opens in the
// browser too, so it must be a real web page.
//
// `tauri dev` (unbundled, can't receive deep links) keeps the in-webview flow
// against the dev server origin, `http://localhost:4001`, like the web app.
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
  ...(usesSystemBrowserAuth
    ? {
        redirectUri: desktopRedirectUri,
        postLogoutRedirectUri: `${appUrl}/goodbye`,
        navigate: desktopNavigate,
      }
    : {
        redirectUri: `${redirectOrigin}/auth/callback`,
        postLogoutRedirectUri: `${redirectOrigin}/goodbye`,
      }),
  ...(isTauri()
    ? {
        storage: createTauriStoreStorage({
          storeFile: "auth.dat",
          keyPrefix: "sdk:",
        }),
      }
    : {}),
};
