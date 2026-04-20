import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, decodeIdToken, fetchUserinfo } from "@/lib/oidc";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LANDING = "/app";

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

  let claims;
  try {
    claims = decodeIdToken(tokens.id_token);
  } catch {
    return errorRedirect(req, "invalid_id_token");
  }

  // Authorization claims (organizations) live in userinfo, not the id_token.
  // Hub keeps id_token slim so BFF session cookies stay under 4 KB — see
  // lib/session.ts. Failing the userinfo fetch should not block sign-in; we
  // fall back to null personal org and let the app resolve it lazily.
  let personalOrgId: string | null = null;
  let personalOrgSlug: string | null = null;
  try {
    const userinfo = await fetchUserinfo(tokens.access_token);
    const personalOrg = userinfo.organizations?.[0];
    if (personalOrg) {
      personalOrgId = personalOrg.id;
      personalOrgSlug = personalOrg.slug;
    }
  } catch {
    /* non-fatal — leave personal org null */
  }

  const session = await getSession();
  session.sub = claims.sub;
  session.email = claims.email;
  session.name = claims.name;
  session.personalOrgId = personalOrgId;
  session.personalOrgSlug = personalOrgSlug;
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

  const landing =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : DEFAULT_LANDING;

  return NextResponse.redirect(new URL(landing, req.url));
}
