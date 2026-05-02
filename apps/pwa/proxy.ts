import { NextRequest, NextResponse } from "next/server";
import { createProxy } from "@stageholder/sdk/nextjs";
import { stageholder } from "@/lib/stageholder";

const PROTECTED_PREFIXES = ["/app", "/onboarding", "/choose-org"];

/**
 * Next.js 16 proxy. Allowlist-style: only the app shell and onboarding
 * flow are gated at this layer. All other routes pass through unchanged.
 *
 * Cookie name comes from `stageholder.config.cookieName` via the SDK's
 * `createProxy(bundle, ...)` overload — drift between this proxy and the
 * SDK's session writer is structurally impossible.
 *
 * Circuit breaker is enabled — after 5 consecutive unauthenticated
 * redirects within 10s the proxy halts at `/auth/error?reason=redirect_loop`
 * instead of looping into ERR_TOO_MANY_REDIRECTS / chrome-error://.
 *
 * Public paths (`/`, `/goodbye`, marketing) and `/auth/*` / `/api/*`
 * pass through. The SDK's `createProxy` already auto-allows `/auth/*`,
 * `/_next/*`, and `/favicon.ico`.
 *
 * Cookie-presence is a coarse guard only. Actual session validity
 * (signature, expiry, custom claims) is checked server-side by
 * `requireSession` / `getSession` from `@stageholder/sdk/nextjs` inside
 * Server Components and Route Handlers.
 */
const sdkProxy = createProxy(stageholder, {
  // Empty publicPaths because we use allowlist semantics below — anything
  // not under PROTECTED_PREFIXES is implicitly public, and we short-circuit
  // before consulting the SDK proxy in that case.
  publicPaths: [],
  circuitBreaker: true,
});

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Non-protected paths pass through without consulting the SDK proxy
  // (allowlist semantics — we don't want to gate `/`, `/goodbye`, etc.)
  if (!isProtected) return NextResponse.next();

  // Protected path: defer to the SDK proxy for cookie check + breaker.
  // The SDK returns either a redirect descriptor or undefined; map back
  // into the NextResponse shape the framework expects.
  const sdkResult = sdkProxy(request);
  if (!sdkResult) return NextResponse.next();

  const location = sdkResult.headers.get("location");
  const res = location
    ? NextResponse.redirect(new URL(location, request.url), sdkResult.status)
    : NextResponse.next();

  // Forward any Set-Cookie headers (the breaker counter).
  for (const setCookie of sdkResult.headers.getSetCookie()) {
    res.headers.append("set-cookie", setCookie);
  }
  return res;
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*", "/choose-org/:path*"],
};
