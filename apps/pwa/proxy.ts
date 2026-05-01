import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/app", "/onboarding"];

/**
 * Next.js 16 proxy. Allowlist-style: only the app shell and onboarding
 * flow are gated at this layer. All other routes pass through unchanged:
 *
 * - Landing (`/`), `/goodbye`, marketing pages — intentionally public.
 * - `/auth/*` — the SDK catch-all owns its own logic.
 * - `/api/*` — every API route handles its own auth and returns JSON 401s
 *   to fetch consumers. Redirecting them to `/auth/login` (HTML) would
 *   break the React tree's `useUser` hook and BFF proxies.
 *
 * Cookie name: `sh_session` — the SDK default, written by
 * `@stageholder/sdk/nextjs`'s catch-all auth route. (Pre-SDK Meridian
 * used `meridian_session`; the rename is part of the SDK refactor.)
 *
 * Cookie-presence is a coarse guard only. Actual session validity
 * (signature, expiry, custom claims) is checked server-side by
 * `requireSession` / `getSession` from `@stageholder/sdk/nextjs` inside
 * Server Components and Route Handlers.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("sh_session");

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*"],
};
