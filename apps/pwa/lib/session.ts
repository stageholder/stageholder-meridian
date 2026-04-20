import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

/**
 * Server-side session. Stored as a sealed iron-session cookie.
 * Access tokens and refresh tokens never reach the browser.
 *
 * Intentionally omits idToken: when `subscriptions` and `organizations`
 * scopes are requested, the id_token alone runs ~2 KB, which pushes the
 * encrypted cookie past the 4 KB browser limit. id_token_hint on
 * RP-initiated logout is optional per OIDC spec — without it the Hub
 * may show a "confirm sign out" prompt, which is acceptable UX.
 * For a future production-grade fix, move all tokens to a server-side
 * session store and keep only a session id in the cookie.
 */
export interface ProductSession {
  sub: string;
  email?: string;
  name?: string;
  personalOrgId?: string | null;
  personalOrgSlug?: string | null;
  // Optional so legacy cookies minted before the onboarding feature
  // decrypt cleanly. The callback fills both on the next sign-in; the
  // /api/me and client gates treat undefined as "not onboarded".
  hasCompletedOnboarding?: boolean;
  timezone?: string | null;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number; // epoch seconds
}

const COOKIE_NAME = "meridian_session";

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  },
};

export async function getSession(): Promise<IronSession<ProductSession>> {
  const cookieStore = await cookies();
  return getIronSession<ProductSession>(cookieStore, sessionOptions);
}

export async function clearSession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
