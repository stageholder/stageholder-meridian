import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { refreshAccessToken } from "@/lib/oidc";
import type { ProductSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.MERIDIAN_API_URL ?? "http://localhost:4000";
const REFRESH_LEEWAY_SECONDS = 60;

async function ensureFreshToken(
  session: Awaited<ReturnType<typeof getSession>>,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (session.accessTokenExpiresAt - REFRESH_LEEWAY_SECONDS > now) {
    return session.accessToken;
  }
  const refreshed = await refreshAccessToken(
    session as unknown as ProductSession,
  );
  session.accessToken = refreshed.accessToken;
  session.refreshToken = refreshed.refreshToken;
  session.accessTokenExpiresAt = refreshed.accessTokenExpiresAt;
  await session.save();
  return session.accessToken;
}

/**
 * BFF route for onboarding completion. Forwards the POST to the Meridian
 * API and, on 2xx, updates the iron-session cookie with the new flag +
 * timezone atomically. This is a dedicated route rather than a pass-through
 * through `/api/v1/[...path]` because the session cache must stay in sync
 * with the DB — otherwise `useUser` returns a stale `hasCompletedOnboarding:
 * false` and the app layout bounces the user back to /onboarding.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.sub) {
    return new NextResponse(null, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshToken(session);
  } catch {
    return new NextResponse(JSON.stringify({ code: "session_expired" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.text();

  const upstream = await fetch(`${API_URL}/api/v1/me/onboarding/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body,
  });

  const respText = await upstream.text();

  if (upstream.ok) {
    try {
      const parsed = JSON.parse(respText) as {
        hasCompletedOnboarding: boolean;
        timezone: string | null;
      };
      session.hasCompletedOnboarding = parsed.hasCompletedOnboarding;
      session.timezone = parsed.timezone;
      await session.save();
    } catch {
      // Upstream returned non-JSON on 2xx — unexpected but not fatal.
      // Session stays stale; next sign-in will correct it.
    }
  }

  return new NextResponse(respText, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
