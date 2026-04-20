import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OpenID Connect Front-Channel Logout endpoint.
 *
 * Hub fires this URL inside a hidden <iframe> when the user signs out from
 * another Stageholder product (Atlas, Almanac, …) or when the Hub itself
 * ends the session. Both browsers share the Hub session cookie, so the Hub
 * notifies every RP that advertises a frontchannel_logout_uri. Our job is
 * to destroy the iron-session cookie for Meridian so the next request
 * requires a fresh sign-in.
 *
 * Per spec (§4.3 of OIDC Front-Channel Logout 1.0):
 *   - Respond 200 with an empty body (or a 1×1 gif) so the iframe load
 *     completes without triggering browser error handling.
 *   - Optional iss / sid query params identify which session was logged
 *     out. We don't scope multiple sessions per user so they're ignored.
 *   - Cache headers must prevent any intermediary or the browser from
 *     replaying the response; future logouts must reach the endpoint.
 *
 * Hub-side registration (do once): set the client's
 * `frontchannel_logout_uri` to `<APP_URL>/auth/frontchannel-logout` and
 * `frontchannel_logout_session_required` to `true`.
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  await clearSession();
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}
