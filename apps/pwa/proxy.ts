import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/app", "/onboarding"];

/**
 * Next.js 16 proxy (the successor to middleware). Guards authenticated
 * surfaces: if a request targets `/app` or `/onboarding` without a
 * `meridian_session` cookie, bounce to `/auth/login?returnTo=...`.
 * Everything else passes through unchanged — the BFF routes under
 * `/auth/*` and `/api/*` are intentionally public at the proxy layer.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("meridian_session");

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/auth/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("returnTo", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*"],
};
