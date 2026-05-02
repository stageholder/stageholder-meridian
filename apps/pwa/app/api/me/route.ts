/**
 * Meridian-specific `/api/me` BFF route.
 *
 * Returns the current user's Meridian-internal fields: onboarding state
 * and personal org. These fields live on `session.custom`
 * (populated by `enrichSession` in the auth catch-all) and are served
 * directly from the session cookie without a live API hop.
 *
 * Called by:
 *   - `hooks/use-user.ts` to merge with SDK identity claims.
 *   - The app shell on every render to determine whether to show onboarding.
 *
 * Authorization: reads from the SDK session cookie. Returns 401 when no
 * session is present. Does NOT call the Meridian API — the session cache
 * is the source of truth for these fields between logins and token refreshes.
 *
 * Note: `personalOrgSlug` is a Meridian-API-only field not presently stored
 * in `session.custom`. If slug-based routing is ever needed server-side,
 * extend `MeridianCustom` and `provisionFromMeridianApi` in
 * `lib/stageholder.ts` / the catch-all route.
 */
import { NextResponse } from "next/server";
import type { ProductSession } from "@stageholder/sdk/nextjs";
import { stageholder, type MeridianCustom } from "@/lib/stageholder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Shape returned by this BFF route to the client. */
export interface MeResponse {
  sub: string;
  email?: string;
  name?: string;
  personalOrgId: string | null;
  hasCompletedOnboarding: boolean;
}

export async function GET(): Promise<NextResponse<MeResponse | null>> {
  const sessionStore = await stageholder.sessionStore();
  const session: ProductSession<MeridianCustom> | null =
    await sessionStore.get();

  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  const body: MeResponse = {
    sub: session.sub,
    email: session.email,
    name: session.name,
    personalOrgId: session.custom?.personalOrgId ?? null,
    hasCompletedOnboarding: session.custom?.hasCompletedOnboarding ?? false,
  };

  return NextResponse.json(body);
}
