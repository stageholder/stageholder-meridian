import { useUser as useSdkUser } from "@stageholder/sdk/spa";
import { useMeridianUserMeta } from "@/lib/me-query";

/**
 * Meridian-specific user shape: SDK identity claims plus the two fields
 * the Meridian API's `/me` endpoint adds on top.
 *
 * Web AND desktop both flow through this hook now — the SDK SPA provider
 * abstracts the underlying token storage (LocalStorage on web,
 * TauriStorageAdapter on desktop, both via the same `useUser()` from
 * `@stageholder/sdk/spa`). The hand-rolled desktop OIDC code from
 * `lib/oidc-tauri.ts` is gone.
 */
export interface MeridianUser {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  personalOrgId: string | null;
  hasCompletedOnboarding: boolean;
  avatar?: string;
}

export function useUser(): {
  user: MeridianUser | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const sdk = useSdkUser();
  const meta = useMeridianUserMeta();

  const isLoading = sdk.isLoading || (!!sdk.user && meta.isLoading);
  const isError = sdk.isError || meta.isError;
  const error = sdk.error ?? meta.error ?? null;

  if (!sdk.user || !meta.data) {
    return { user: null, isLoading, isError, error };
  }

  const user: MeridianUser = {
    sub: sdk.user.sub,
    email: sdk.user.email,
    name: sdk.user.name,
    picture: sdk.user.picture,
    avatar: sdk.user.picture,
    personalOrgId: meta.data.personalOrgId || null,
    hasCompletedOnboarding: meta.data.hasCompletedOnboarding,
  };

  return { user, isLoading: false, isError: false, error: null };
}
