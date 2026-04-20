import { NextRequest, NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/session";
import { revokeRefreshToken } from "@/lib/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISSUER = process.env.IDENTITY_ISSUER_URL!;

function postLogoutUri(req: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  return `${base}/goodbye`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const idToken = session.idToken;
  const refreshToken = session.refreshToken;

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  await clearSession();

  if (!idToken) {
    return NextResponse.redirect(postLogoutUri(req));
  }

  const params = new URLSearchParams({
    id_token_hint: idToken,
    post_logout_redirect_uri: postLogoutUri(req),
  });
  return NextResponse.redirect(
    `${ISSUER}/oidc/session/end?${params.toString()}`,
  );
}
