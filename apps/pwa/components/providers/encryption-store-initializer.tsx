"use client";
import { useEffect } from "react";
import { useUser } from "@/hooks/use-user";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import { setCurrentUserSub } from "@/lib/current-user-sub";
import { clearForOtherSubs } from "@repo/offline/sync/mutation-queue";

/**
 * Session bootstrap: populates the module-level `currentUserSub`, hydrates
 * the encryption store with the OIDC `sub` (used as the recovery-path
 * salt), and clears any mutations queued by a previously signed-in user.
 *
 * Renamed intent: historically "EncryptionStoreInitializer" — now covers
 * the broader user-session lifecycle, but keeping the name to minimise
 * churn for Group 9's UI cleanup.
 */
export function EncryptionStoreInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const init = useEncryptionStore((s) => s.init);

  useEffect(() => {
    if (user?.sub) {
      setCurrentUserSub(user.sub);
      init(user.sub);
      // Drop any stale mutations from a previously signed-in user
      void clearForOtherSubs(user.sub).catch(() => {});
    } else {
      setCurrentUserSub(null);
    }
  }, [user?.sub, init]);

  return <>{children}</>;
}
