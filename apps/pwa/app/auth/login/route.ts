import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { newPkce, buildAuthorizeUrl } from "@/lib/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PKCE_COOKIE_MAX_AGE = 600; // 10 minutes

function isSafeReturnTo(value: string | null): string | null {
  if (!value) return null;
  // Only allow absolute paths, not protocol-relative or external URLs.
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/\\")) return null;
  return value;
}

export async function GET(req: NextRequest) {
  const { verifier, challenge, state } = newPkce();
  const returnTo = isSafeReturnTo(req.nextUrl.searchParams.get("returnTo"));

  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: PKCE_COOKIE_MAX_AGE,
  };
  cookieStore.set("oauth_state", state, cookieOpts);
  cookieStore.set("oauth_pkce", verifier, cookieOpts);
  if (returnTo) {
    cookieStore.set("oauth_return_to", returnTo, cookieOpts);
  }

  return NextResponse.redirect(buildAuthorizeUrl({ state, challenge }));
}
