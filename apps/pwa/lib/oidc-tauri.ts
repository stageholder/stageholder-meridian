"use client";

/**
 * Tauri-only OIDC PKCE flow. Uses @fabianlars/tauri-plugin-oauth to bind a
 * loopback listener on an ephemeral port, opens the Hub in the system
 * browser via the opener plugin, and exchanges the returned authorization
 * code for tokens. The refresh token is persisted to tauri-plugin-store;
 * the access token lives in memory only.
 *
 * Web BFF flow (lib/oidc.ts + /auth/*) is used by the browser build. This
 * file must only be imported from client code that already checks
 * detectPlatform() === "desktop".
 *
 * NOTE on plugin package: the pre-existing package in the monorepo is
 * `@fabianlars/tauri-plugin-oauth` (matches the Rust `tauri-plugin-oauth`
 * crate registered in lib.rs). Its JS API exposes `start`, `cancel`,
 * `onUrl`, `onInvalidUrl` — `onUrl` is a `listen("oauth://url", ...)`
 * wrapper. We use it directly rather than importing `@tauri-apps/api/event`.
 */

import {
  start as startOauthListener,
  cancel as cancelOauthListener,
  onUrl as onOauthUrl,
  onInvalidUrl as onOauthInvalidUrl,
} from "@fabianlars/tauri-plugin-oauth";
import { load as loadStore, type Store } from "@tauri-apps/plugin-store";
import { openUrl } from "@tauri-apps/plugin-opener";

const ISSUER = (process.env.NEXT_PUBLIC_IDENTITY_ISSUER_URL ??
  "http://localhost:4828") as string;
const CLIENT_ID = "meridian-desktop";
const SCOPES =
  "openid offline_access profile email organizations subscriptions";
const STORE_FILE = "auth.dat";
const REFRESH_KEY = "refresh_token";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

export interface InMemorySession {
  accessToken: string;
  idToken: string;
  accessTokenExpiresAt: number;
  sub: string;
  email?: string;
}

let memorySession: InMemorySession | null = null;

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

function decodeIdToken(idToken: string): { sub: string; email?: string } {
  const [, payload] = idToken.split(".");
  if (!payload) throw new Error("Malformed id_token");
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}

async function getStore(): Promise<Store> {
  return loadStore(STORE_FILE);
}

async function readRefreshToken(): Promise<string | null> {
  const store = await getStore();
  const value = await store.get<string>(REFRESH_KEY);
  return typeof value === "string" ? value : null;
}

async function writeRefreshToken(token: string): Promise<void> {
  const store = await getStore();
  await store.set(REFRESH_KEY, token);
  await store.save();
}

async function deleteRefreshToken(): Promise<void> {
  const store = await getStore();
  await store.delete(REFRESH_KEY);
  await store.save();
}

/**
 * Kicks off the sign-in flow. Opens the Hub in the system browser and
 * listens on an ephemeral loopback port for the redirect. Resolves with
 * the in-memory session when the user finishes consent. Rejects if the
 * user closes the browser / cancels or the redirect times out.
 */
export async function signInTauri(): Promise<InMemorySession> {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(await sha256(verifier));
  const state = base64url(randomBytes(32));

  let unlistenUrl: (() => void) | null = null;
  let unlistenInvalid: (() => void) | null = null;
  let port = 0;

  const cleanup = async () => {
    if (unlistenUrl) {
      try {
        unlistenUrl();
      } catch {
        /* ignore */
      }
      unlistenUrl = null;
    }
    if (unlistenInvalid) {
      try {
        unlistenInvalid();
      } catch {
        /* ignore */
      }
      unlistenInvalid = null;
    }
    if (port > 0) {
      try {
        await cancelOauthListener(port);
      } catch {
        /* ignore */
      }
    }
  };

  try {
    // Wire the URL listener BEFORE starting the server so we don't miss the
    // callback on a fast browser. Plugin fires "oauth://url" with the full
    // callback URL as the payload.
    const received = new Promise<string>((resolve, reject) => {
      onOauthUrl((url) => resolve(url))
        .then((fn) => {
          unlistenUrl = fn;
        })
        .catch(reject);
      onOauthInvalidUrl((err) => reject(new Error(`Invalid OAuth URL: ${err}`)))
        .then((fn) => {
          unlistenInvalid = fn;
        })
        .catch(reject);
    });

    port = await startOauthListener({
      response: `<!doctype html><html><body style="font-family:system-ui;padding:40px;text-align:center"><h2>Sign-in complete</h2><p>You can close this window and return to Meridian.</p></body></html>`,
    });

    const redirectUri = `http://127.0.0.1:${port}/callback`;
    const authParams = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    await openUrl(`${ISSUER}/oidc/auth?${authParams.toString()}`);

    const callbackUrl = await received;
    const parsed = new URL(callbackUrl);
    const returnedState = parsed.searchParams.get("state");
    const code = parsed.searchParams.get("code");
    if (returnedState !== state) {
      throw new Error("OAuth state mismatch");
    }
    if (!code) {
      const errDesc =
        parsed.searchParams.get("error_description") ??
        parsed.searchParams.get("error") ??
        "no code in callback";
      throw new Error(`OAuth callback error: ${errDesc}`);
    }

    const tokens = await exchangeCode(code, verifier, redirectUri);
    const claims = decodeIdToken(tokens.id_token);
    await writeRefreshToken(tokens.refresh_token);
    memorySession = {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      accessTokenExpiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
      sub: claims.sub,
      email: claims.email,
    };
    return memorySession;
  } finally {
    await cleanup();
  }
}

async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    client_id: CLIENT_ID,
  });
  const res = await fetch(`${ISSUER}/oidc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

async function refreshTauriTokens(): Promise<InMemorySession | null> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  const res = await fetch(`${ISSUER}/oidc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    // Refresh token is dead (expired / revoked / rotated-already-used).
    // Clear it so the next call triggers a fresh sign-in.
    await deleteRefreshToken();
    memorySession = null;
    return null;
  }
  const tokens = (await res.json()) as TokenResponse;
  // Refresh tokens rotate on every use — always persist the new one
  // atomically before returning.
  await writeRefreshToken(tokens.refresh_token);
  const claims = decodeIdToken(tokens.id_token);
  memorySession = {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    accessTokenExpiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    sub: claims.sub,
    email: claims.email,
  };
  return memorySession;
}

/**
 * Returns a fresh access token, refreshing if within 60s of expiry.
 * Returns null if no refresh token is stored (user must sign in).
 */
export async function getAccessTokenTauri(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (memorySession && memorySession.accessTokenExpiresAt - 60 > now) {
    return memorySession.accessToken;
  }
  const refreshed = await refreshTauriTokens();
  return refreshed?.accessToken ?? null;
}

/**
 * Returns the current session, trying a silent refresh if only the refresh
 * token is available. Returns null when no refresh token is stored.
 */
export async function getSessionTauri(): Promise<InMemorySession | null> {
  if (memorySession) return memorySession;
  return refreshTauriTokens();
}

/**
 * Sign out: best-effort revoke, clear local store, clear in-memory session.
 */
export async function signOutTauri(): Promise<void> {
  const refreshToken = await readRefreshToken();
  if (refreshToken) {
    try {
      await fetch(`${ISSUER}/oidc/token/revocation`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: refreshToken,
          token_type_hint: "refresh_token",
          client_id: CLIENT_ID,
        }),
      });
    } catch {
      /* ignore */
    }
  }
  await deleteRefreshToken();
  memorySession = null;
}
