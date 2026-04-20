import { NextRequest, NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/session";
import { revokeRefreshToken } from "@/lib/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISSUER = process.env.IDENTITY_ISSUER_URL!;
const CLIENT_ID = process.env.IDENTITY_CLIENT_ID!;

function postLogoutUri(req: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  return `${base}/goodbye`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const refreshToken = session.refreshToken;

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  await clearSession();

  // Always route through Hub's end_session_endpoint. Without this the Hub
  // session cookie survives (14-day sliding TTL), so the next /auth/login
  // silently reuses the existing first-party Grant and signs the user
  // straight back in. We intentionally don't persist id_token in the iron
  // cookie (see lib/session.ts for the cookie-size rationale), so the Hub
  // renders its branded one-click logout confirmation instead of an
  // id_token_hint-driven silent logout.
  //
  // 303 See Other (not 307): oidc-provider's /session/end handles GET and
  // POST as two different operations — GET renders the logout confirm form
  // with an XSRF token, POST requires that token as part of the submitted
  // body. We want the browser to follow the redirect with a GET so the
  // user lands on the confirm form; 307 preserves the original POST and
  // Hub rejects it as a missing-XSRF submission.
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    post_logout_redirect_uri: postLogoutUri(req),
  });
  return NextResponse.redirect(
    `${ISSUER}/session/end?${params.toString()}`,
    303,
  );
}
