"use client";

import { useQuery } from "@tanstack/react-query";
import { detectPlatform } from "@repo/core/platform";
import type { MeResponse } from "@/app/api/me/route";

export type MeridianUser = MeResponse & {
  avatar?: string;
};

async function fetchMeWeb(): Promise<MeridianUser | null> {
  const res = await fetch("/api/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`GET /api/me failed: ${res.status}`);
  return (await res.json()) as MeridianUser;
}

const DESKTOP_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const DESKTOP_ISSUER =
  process.env.NEXT_PUBLIC_IDENTITY_ISSUER_URL ?? "http://localhost:4828/oidc";
const DESKTOP_CLIENT_ID = "meridian-desktop";

/**
 * Desktop: identity claims come from the id_token (verified via JWKS, not
 * base64-decoded in the dark). Authz + Meridian state come from the API,
 * where the backend's Stageholder auth guard has verified the access token.
 * No unsigned token data crosses the trust boundary.
 */
async function fetchMeDesktop(): Promise<MeridianUser | null> {
  const { getSessionTauri } = await import("@/lib/oidc-tauri");
  const session = await getSessionTauri();
  if (!session) return null;

  let identity: {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  try {
    const { verifyIdToken } = await import("@stageholder/auth/client");
    identity = await verifyIdToken(session.idToken, {
      issuerUrl: DESKTOP_ISSUER,
      clientId: DESKTOP_CLIENT_ID,
    });
  } catch {
    // Verification failed — treat as unauthenticated. Fail-closed; the
    // layout effect will bounce to sign-in.
    return null;
  }

  let hasCompletedOnboarding = false;
  let timezone: string | null = null;
  let personalOrgId: string | null = null;
  let personalOrgSlug: string | null = null;
  try {
    const res = await fetch(`${DESKTOP_API_URL}/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (res.ok) {
      const me = (await res.json()) as {
        hasCompletedOnboarding: boolean;
        timezone: string | null;
        personalOrgId: string | null;
        personalOrgSlug: string | null;
      };
      hasCompletedOnboarding = me.hasCompletedOnboarding;
      timezone = me.timezone;
      personalOrgId = me.personalOrgId;
      personalOrgSlug = me.personalOrgSlug;
    }
  } catch {
    /* non-fatal — defaults route to /onboarding which surfaces outage */
  }

  return {
    sub: identity.sub,
    email: identity.email,
    name: identity.name,
    personalOrgId,
    personalOrgSlug,
    hasCompletedOnboarding,
    timezone,
    avatar: identity.picture,
  };
}

async function fetchMe(): Promise<MeridianUser | null> {
  if (detectPlatform() === "desktop") return fetchMeDesktop();
  return fetchMeWeb();
}

export function useUser() {
  return useQuery<MeridianUser | null>({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: false,
  });
}
