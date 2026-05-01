"use client";

import { detectPlatform } from "@repo/core/platform";
import { useUser as useSdkUser } from "@stageholder/sdk/react";
import { useQuery } from "@tanstack/react-query";

/**
 * Meridian-specific user shape extended with fields returned by the Meridian
 * API's `GET /api/v1/me` endpoint (onboarding state, timezone, personal org).
 * These fields are Meridian-internal and are NOT part of the SDK's `MeResponse`
 * — they live in the Meridian API's user document, not in OIDC token claims.
 */
export interface MeridianUser {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  personalOrgId: string | null;
  personalOrgSlug: string | null;
  hasCompletedOnboarding: boolean;
  timezone: string | null;
  avatar?: string;
}

// ─── Desktop variant (unchanged — Plan 4 deferred) ──────────────────────────

const DESKTOP_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const DESKTOP_ISSUER =
  process.env.NEXT_PUBLIC_IDENTITY_ISSUER_URL ?? "http://localhost:4828/oidc";
const DESKTOP_CLIENT_ID = "meridian-desktop";

/**
 * Desktop: identity claims come from the id_token (verified via JWKS, not
 * base64-decoded). Authz + Meridian state come from the API, where the
 * backend's Stageholder auth guard has verified the access token.
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
    const { verifyIdToken } = await import("@stageholder/sdk/core");
    identity = await verifyIdToken(session.idToken, {
      issuerUrl: DESKTOP_ISSUER,
      clientId: DESKTOP_CLIENT_ID,
      audience: "urn:stageholder:api",
    });
  } catch {
    // Verification failed — treat as unauthenticated. Fail-closed.
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

// ─── Web variant — SDK-backed ─────────────────────────────────────────────

/**
 * Meridian-specific fields not present in the SDK's `/auth/me` response.
 * Fetched from the BFF's `/api/me` route which reads from the Meridian API
 * (upserted during the post-login JIT provisioning step).
 *
 * Only called on web; desktop uses `fetchMeDesktop` which calls the API
 * directly with a Bearer token.
 */
async function fetchMeridianExtras(): Promise<{
  personalOrgId: string | null;
  personalOrgSlug: string | null;
  hasCompletedOnboarding: boolean;
  timezone: string | null;
} | null> {
  const res = await fetch("/api/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return (await res.json()) as {
    personalOrgId: string | null;
    personalOrgSlug: string | null;
    hasCompletedOnboarding: boolean;
    timezone: string | null;
  };
}

// ─── Combined hook ────────────────────────────────────────────────────────

/**
 * Read the current authenticated user, including Meridian-specific fields
 * (`personalOrgId`, `personalOrgSlug`, `hasCompletedOnboarding`, `timezone`).
 *
 * **Web:** identity claims come from the SDK's `<StageholderProvider>` via
 * `useUser()`. Meridian-specific fields are fetched from the BFF's
 * `/api/me` route (a thin proxy to the Meridian API's `GET /api/v1/me`).
 *
 * **Desktop (Tauri):** both identity and Meridian fields come from the Tauri
 * session + a direct API call with a Bearer token. Plan 4 migration deferred.
 *
 * Returns `null` for `user` when loading, unauthenticated, or on error.
 */
export function useUser(): {
  user: MeridianUser | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const isDesktop = detectPlatform() === "desktop";

  // Desktop path: use TanStack Query directly (SDK provider not active on desktop).
  const desktopQuery = useQuery<MeridianUser | null>({
    queryKey: ["me-desktop"],
    queryFn: fetchMeDesktop,
    staleTime: 60_000,
    retry: false,
    enabled: isDesktop,
  });

  // Web path: SDK identity + Meridian-specific extras in parallel.
  const sdkUser = useSdkUser();
  const extrasQuery = useQuery({
    queryKey: ["me-meridian-extras"],
    queryFn: fetchMeridianExtras,
    staleTime: 60_000,
    retry: false,
    enabled: !isDesktop && sdkUser.user !== null,
  });

  if (isDesktop) {
    return {
      user: desktopQuery.data ?? null,
      isLoading: desktopQuery.isLoading,
      isError: desktopQuery.isError,
      error: desktopQuery.error ?? null,
    };
  }

  // Web: merge SDK identity with Meridian-specific extras.
  const isLoading = sdkUser.isLoading || extrasQuery.isLoading;
  const isError = sdkUser.isError || extrasQuery.isError;
  const error = sdkUser.error ?? extrasQuery.error ?? null;

  if (!sdkUser.user || !extrasQuery.data) {
    return { user: null, isLoading, isError, error };
  }

  const user: MeridianUser = {
    sub: sdkUser.user.sub,
    email: sdkUser.user.email,
    name: sdkUser.user.name,
    personalOrgId: extrasQuery.data.personalOrgId,
    personalOrgSlug: extrasQuery.data.personalOrgSlug,
    hasCompletedOnboarding: extrasQuery.data.hasCompletedOnboarding,
    timezone: extrasQuery.data.timezone,
    avatar: sdkUser.user.picture,
  };

  return { user, isLoading: false, isError: false, error: null };
}
