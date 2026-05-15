import type { StageholderSpaConfig } from "@stageholder/sdk/spa";
import { ConfigError } from "@stageholder/sdk/spa";
import { TauriStorageAdapter } from "@/lib/tauri-storage";

function readEnv(key: string): string {
  const value = import.meta.env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ConfigError(
      `Missing required env var ${key}. Set it in apps/pwa/.env.local.`,
    );
  }
  return value;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const issuerUrl = readEnv("VITE_IDENTITY_ISSUER_URL");
const clientId = readEnv("VITE_IDENTITY_CLIENT_ID");
const appUrl = readEnv("VITE_PUBLIC_APP_URL");

// Desktop uses a fixed loopback port the Tauri Rust side (via
// tauri-plugin-oauth) opens for the OIDC redirect; web uses the deployed
// app origin. Both must be registered as redirect_uris on the
// meridian-web OIDC client at the Hub.
const TAURI_LOOPBACK_ORIGIN = "http://localhost:14001";
const redirectOrigin = isTauri() ? TAURI_LOOPBACK_ORIGIN : appUrl;

// On desktop, persist session via tauri-plugin-store so tokens survive
// `clear_all_browsing_data()` at every Tauri cold boot (`src-tauri/src/lib.rs`).
// On web, the SDK's default LocalStorageAdapter applies — no storage option.
export const spaConfig: StageholderSpaConfig = {
  issuerUrl,
  clientId,
  redirectUri: `${redirectOrigin}/auth/callback`,
  postLogoutRedirectUri: `${redirectOrigin}/goodbye`,
  ...(isTauri() ? { storage: new TauriStorageAdapter() } : {}),
};
