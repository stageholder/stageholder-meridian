import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Root entry point. Plain HTTP 307 redirect based on session presence.
 *
 * Why this is a route handler instead of `app/page.tsx`:
 * A page that calls `redirect()` embeds a client-side-navigable redirect
 * directive into the RSC stream. When the target is a BFF auth route
 * that itself 302s to a cross-origin Hub, the browser's client-side
 * RSC fetch hits that cross-origin hop under CORS mode and fails. Next
 * does fall back to browser navigation, but only after a noisy error
 * cascade and a visible delay. A pure route handler skips all that —
 * it's a top-level 307 the browser follows natively, no CORS.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const hasSession = (await cookies()).has("meridian_session");
  const target = hasSession ? "/app" : "/auth/login";
  return NextResponse.redirect(new URL(target, request.url));
}
