/**
 * Stageholder SDK catch-all auth route for Meridian.
 *
 * Handles all standard OAuth / OIDC sub-routes under `/auth/*`:
 *   GET  /auth/login          — PKCE + state, redirect to hub /oidc/auth
 *   GET  /auth/callback       — state check, code exchange, session write
 *   POST /auth/logout         — revoke tokens, clear session, end-session redirect
 *   GET  /auth/logout-notify  — front-channel logout listener (hub iframe call)
 *   POST /auth/refresh        — force refresh-token rotation
 *   GET  /auth/me             — current user JSON (consumed by StageholderProvider)
 *   POST /auth/switch-org     — update active org in session
 *   GET  /auth/events         — SSE stream for invalidation signals
 *
 * Config lives entirely on the `stageholder` bundle in `lib/stageholder.ts`
 * (single source of truth — see SDK README "One config, two consumers").
 * Only the per-route hooks (which are functions, not config) are wired here.
 *
 * `enrichSession` wires in the JIT provisioning call: at every session
 * create or refresh, `GET /api/v1/me` is called on the Meridian API to
 * upsert the user row and populate `session.custom` (`personalOrgId`,
 * `hasCompletedOnboarding`, `timezone`). Downstream `getSession()` calls
 * read these fields without a live API hop.
 *
 * `afterCallback` replaces the `/post-login` Server Component workaround:
 * users who have not completed onboarding are redirected to `/onboarding`
 * server-side before the browser receives the first redirect response.
 */
import { stageholderAuth } from "@stageholder/sdk/nextjs";
import type { ProductSession } from "@stageholder/sdk/nextjs";
import { stageholder, type MeridianCustom } from "@/lib/stageholder";

export const { GET, POST } = stageholderAuth<MeridianCustom>(stageholder, {
  enrichSession: async (
    session: Omit<ProductSession<MeridianCustom>, "custom">,
  ): Promise<MeridianCustom> => {
    return provisionFromMeridianApi(session.accessToken);
  },
  afterCallback: async (
    session: ProductSession<MeridianCustom>,
  ): Promise<{ redirectTo?: string } | void> => {
    if (session.custom && !session.custom.hasCompletedOnboarding) {
      return { redirectTo: "/onboarding" };
    }
    // Falls through to the default loginRedirectPath ("/" — set on the bundle).
  },
});

/**
 * Best-effort JIT provisioning + extras fetch from Meridian's API.
 *
 * Calls `GET /api/v1/me` (which upserts the user row on first call), reads
 * back `hasCompletedOnboarding`, `personalOrgId`, and `timezone`, and
 * returns the typed payload that the SDK assigns to `session.custom`.
 *
 * - Throws on `401`/`403` (token rejected) so login fails loudly rather than
 *   silently succeeding with stale session state.
 * - Returns sensible defaults on transient upstream failures (5xx, network
 *   error) so a user can still reach the app even if the Meridian API is
 *   temporarily degraded.
 *
 * @param accessToken - The OIDC access token received from the hub.
 * @returns Typed `MeridianCustom` payload for `session.custom`.
 * @throws If the Meridian API explicitly rejects the token (401/403).
 */
async function provisionFromMeridianApi(
  accessToken: string,
): Promise<MeridianCustom> {
  const apiUrl = process.env.MERIDIAN_API_URL;
  if (!apiUrl) {
    throw new Error("MERIDIAN_API_URL is not set");
  }

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api/v1/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    // Network-level failure (DNS, timeout, etc.) — degrade gracefully.
    return { personalOrgId: "", hasCompletedOnboarding: false, timezone: null };
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Meridian API rejected token at JIT provisioning: ${res.status}`,
    );
  }

  if (!res.ok) {
    // Transient server error — degrade gracefully so login still completes.
    return { personalOrgId: "", hasCompletedOnboarding: false, timezone: null };
  }

  const body = (await res.json()) as {
    personalOrgId?: string;
    hasCompletedOnboarding?: boolean;
    timezone?: string | null;
  };

  return {
    personalOrgId: body.personalOrgId ?? "",
    hasCompletedOnboarding: body.hasCompletedOnboarding ?? false,
    timezone: body.timezone ?? null,
  };
}
