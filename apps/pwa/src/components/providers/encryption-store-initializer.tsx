import { useEffect } from "react";
import { useUser } from "@/hooks/use-user";
import { useEncryptionStore } from "@/lib/crypto/encryption-store";
import { setCurrentUserSub } from "@/lib/current-user-sub";

/**
 * Session bootstrap: populates the module-level `currentUserSub` and
 * hydrates the encryption store with the OIDC `sub` (used as the
 * recovery-path salt).
 *
 * Previously also cleared any offline mutations queued by a previously
 * signed-in user — that queue lived in the now-removed offline package,
 * so the cross-user cleanup is gone with it.
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
    } else {
      setCurrentUserSub(null);
    }
  }, [user?.sub, init]);

  return <>{children}</>;
}
