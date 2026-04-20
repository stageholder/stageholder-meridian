import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyIdToken } from "@stageholder/auth/client";
import { exchangeCode, fetchMeridianMe } from "@/lib/oidc";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LANDING = "/app";
const ISSUER = process.env.IDENTITY_ISSUER_URL!;
const CLIENT_ID = process.env.IDENTITY_CLIENT_ID!;

function errorRedirect(req: NextRequest, reason: string): NextResponse {
  const url = new URL("/auth/error", req.url);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) return errorRedirect(req, oauthError);
  if (!code || !state) return errorRedirect(req, "missing_params");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  const verifier = cookieStore.get("oauth_pkce")?.value;
  const returnTo = cookieStore.get("oauth_return_to")?.value;

  if (!storedState || storedState !== state || !verifier) {
    return errorRedirect(req, "state_mismatch");
  }

  let tokens;
  try {
    tokens = await exchangeCode(code, verifier);
  } catch {
    return errorRedirect(req, "token_exchange_failed");
  }

  // Verify id_token signature, issuer, audience, and expiry per OIDC Core
  // §3.1.3.7. The Hub's JWKS is cached in-process after the first fetch.
  let identity;
  try {
    identity = await verifyIdToken(tokens.id_token, {
      issuerUrl: ISSUER,
      clientId: CLIENT_ID,
    });
  } catch {
    return errorRedirect(req, "invalid_id_token");
  }

  // Meridian API `/me` returns everything we need in one hop: identity
  // (mirror of the id_token claims — kept in response shape for convenience),
  // authz (personal org from verified access-token claims), and Meridian-
  // side state (onboarding flag, timezone). Non-fatal: if the API is down,
  // we still complete sign-in and land the user on /onboarding. The
  // completion POST surfaces any real outage where it can actually be
  // shown to the user.
  let hasCompletedOnboarding = false;
  let timezone: string | null = null;
  let personalOrgId: string | null = null;
  let personalOrgSlug: string | null = null;
  try {
    const me = await fetchMeridianMe(tokens.access_token);
    hasCompletedOnboarding = me.hasCompletedOnboarding;
    timezone = me.timezone;
    personalOrgId = me.personalOrgId;
    personalOrgSlug = me.personalOrgSlug;
  } catch {
    /* non-fatal — default to not-onboarded; org stays null */
  }

  const session = await getSession();
  session.sub = identity.sub;
  session.email = identity.email;
  session.name = identity.name;
  session.personalOrgId = personalOrgId;
  session.personalOrgSlug = personalOrgSlug;
  session.hasCompletedOnboarding = hasCompletedOnboarding;
  session.timezone = timezone;
  session.accessToken = tokens.access_token;
  session.refreshToken = tokens.refresh_token;
  // id_token deliberately NOT persisted. It's only used as the optional
  // id_token_hint on RP-initiated logout; including it puts the encrypted
  // cookie over the 4 KB browser limit when `subscriptions` and
  // `organizations` scopes are in use.
  session.accessTokenExpiresAt =
    Math.floor(Date.now() / 1000) + tokens.expires_in;
  await session.save();

  cookieStore.delete("oauth_state");
  cookieStore.delete("oauth_pkce");
  cookieStore.delete("oauth_return_to");

  const safeReturnTo =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : null;

  // A user who hasn't completed Meridian onboarding goes straight there —
  // their returnTo (if any) is deliberately ignored until onboarding
  // finishes. After /onboarding they land on /app.
  const landing = !hasCompletedOnboarding
    ? "/onboarding"
    : (safeReturnTo ?? DEFAULT_LANDING);

  return NextResponse.redirect(new URL(landing, req.url));
}
