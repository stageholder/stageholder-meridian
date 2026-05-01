/**
 * BFF route for onboarding completion.
 *
 * Forwards the POST to the Meridian API and additionally updates
 * `session.custom.hasCompletedOnboarding` to `true` atomically, so
 * subsequent `GET /api/me` calls reflect the state change without waiting for
 * the next token refresh cycle to re-run `enrichSession`.
 *
 * This is a dedicated BFF route (not a pass-through via `/api/v1/[...path]`)
 * because the session write must be atomic with the upstream POST — a generic
 * proxy route does not have the domain knowledge to update `session.custom`.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuth } from "@stageholder/sdk/nextjs";
import { SessionExpiredError } from "@stageholder/sdk/core";
import { stageholder } from "@/lib/stageholder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.MERIDIAN_API_URL ?? "http://localhost:4000";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sessionStore = await stageholder.sessionStore();
  const session = await sessionStore.get();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetchWithAuth(`${API_URL}/api/v1/me/onboarding/complete`, {
      config: stageholder.config,
      sessionStore,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      },
    });
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return new NextResponse(JSON.stringify({ code: "session_expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err;
  }

  // On success, update session.custom so subsequent /api/me reads immediately
  // reflect the completed state without waiting for a full token refresh.
  if (upstream.ok && session.custom) {
    await sessionStore.set({
      ...session,
      custom: { ...session.custom, hasCompletedOnboarding: true },
    });
  }

  const respText = await upstream.text();
  return new NextResponse(respText, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
