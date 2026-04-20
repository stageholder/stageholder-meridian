import { randomBytes, createHash } from "crypto";
import type { ProductSession } from "./session";

const ISSUER = process.env.IDENTITY_ISSUER_URL!;
const CLIENT_ID = process.env.IDENTITY_CLIENT_ID!;
const CLIENT_SECRET = process.env.IDENTITY_CLIENT_SECRET!;
const REDIRECT_URI = process.env.IDENTITY_REDIRECT_URI!;

const SCOPES =
  "openid offline_access profile email organizations subscriptions";

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface PkceSet {
  verifier: string;
  challenge: string;
  state: string;
}

export function newPkce(): PkceSet {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(32));
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl(opts: {
  state: string;
  challenge: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
  });
  return `${ISSUER}/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

function basicAuth(): string {
  return Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}

export async function exchangeCode(
  code: string,
  verifier: string,
): Promise<TokenResponse> {
  const res = await fetch(`${ISSUER}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${body}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(
  session: ProductSession,
): Promise<ProductSession> {
  const res = await fetch(`${ISSUER}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error("Refresh failed; user must re-authenticate");
  }
  const t = (await res.json()) as TokenResponse;
  return {
    ...session,
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    // id_token is intentionally discarded — see lib/session.ts for the
    // cookie-size rationale. The Hub still returns one on refresh; we
    // just don't carry it in the session.
    accessTokenExpiresAt: Math.floor(Date.now() / 1000) + t.expires_in,
  };
}

/**
 * Best-effort refresh-token revocation. Errors are swallowed because the
 * caller is usually signing the user out — we don't want to fail logout if
 * the identity service is briefly unavailable.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    await fetch(`${ISSUER}/token/revocation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth()}`,
      },
      body: new URLSearchParams({
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
      // Short timeout: this is best-effort during sign-out. If the Hub is
      // slow we'd rather the user see /goodbye quickly than stall logout.
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* swallowed intentionally */
  }
}

export interface MeridianMeResponse {
  sub: string;
  email: string | null;
  name: string | null;
  personalOrgId: string | null;
  personalOrgSlug: string | null;
  hasCompletedOnboarding: boolean;
  timezone: string | null;
}

const MERIDIAN_API_URL =
  process.env.MERIDIAN_API_URL ?? "http://localhost:4000";

/**
 * Server-to-server call to the Meridian API's `GET /me`. Returns identity,
 * authz (personal org), and Meridian-side state (onboarding flag, timezone)
 * in a single hop — all of it already verified by the backend's Stageholder
 * auth guard, so the BFF doesn't need to re-verify or call userinfo separately.
 * The API upserts the User document on first access, so this doubles as JIT
 * provisioning.
 */
export async function fetchMeridianMe(
  accessToken: string,
): Promise<MeridianMeResponse> {
  const res = await fetch(`${MERIDIAN_API_URL}/api/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Bound the login critical path — must not hang on a slow API.
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`meridian /me request failed: ${res.status}`);
  }
  return (await res.json()) as MeridianMeResponse;
}
