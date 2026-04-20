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

/**
 * Desktop: derive the user profile from the id_token stored in memory.
 * The Hub issues an id_token whose claims mirror the web `/api/me` shape
 * (sub/email/name + organizations[]). We decode it client-side rather
 * than round-tripping to a BFF endpoint that doesn't exist here.
 */
async function fetchMeDesktop(): Promise<MeridianUser | null> {
  const { getSessionTauri } = await import("@/lib/oidc-tauri");
  const session = await getSessionTauri();
  if (!session) return null;
  const parts = session.idToken.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  const payload = JSON.parse(
    atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
  ) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
    organizations?: { id: string; slug: string }[];
  };
  const personalOrg = payload.organizations?.[0];
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    personalOrgId: personalOrg?.id ?? null,
    personalOrgSlug: personalOrg?.slug ?? null,
    avatar: payload.picture,
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
