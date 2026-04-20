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
  return `${ISSUER}/oidc/auth?${params.toString()}`;
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
  const res = await fetch(`${ISSUER}/oidc/token`, {
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

export interface IdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export function decodeIdToken(idToken: string): IdTokenClaims {
  const [, payload] = idToken.split(".");
  const decoded = Buffer.from(payload, "base64").toString("utf-8");
  return JSON.parse(decoded) as IdTokenClaims;
}

export interface UserinfoOrganization {
  id: string;
  slug: string;
  name: string;
  role: string;
}

export interface UserinfoResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  organizations?: UserinfoOrganization[];
  [key: string]: unknown;
}

/**
 * Fetch the Hub's userinfo endpoint with the freshly-issued access token.
 *
 * Authorization claims (organizations, product_access, subscriptions) live
 * in userinfo and in the JWT access token — but NOT in the id_token, which
 * the Hub deliberately keeps slim so BFF session cookies stay under 4 KB.
 * We call userinfo once at callback time to resolve the personal org, then
 * cache the result in the session.
 */
export async function fetchUserinfo(
  accessToken: string,
): Promise<UserinfoResponse> {
  const res = await fetch(`${ISSUER}/oidc/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Bound the login critical path — a slow or hung Hub must not hold the
    // callback route indefinitely. 5s is generous; userinfo is an in-memory
    // lookup on Hub.
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`userinfo request failed: ${res.status}`);
  }
  return (await res.json()) as UserinfoResponse;
}

export async function refreshAccessToken(
  session: ProductSession,
): Promise<ProductSession> {
  const res = await fetch(`${ISSUER}/oidc/token`, {
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
    await fetch(`${ISSUER}/oidc/token/revocation`, {
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
