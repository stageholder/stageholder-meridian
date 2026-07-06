// apps/mobile/lib/use-level-up.ts
//
// Port of the PWA's use-level-up (apps/pwa/src/lib/hooks/use-level-up.ts):
// fire the level-up celebration only on an OBSERVED tier INCREASE within the
// current session (ref-compare against the previous value), never on first
// load. Shared by BOTH the Today dashboard and the Journey screen so a tier
// crossing is celebrated wherever the user happens to be when it lands — and so
// the ref-compare logic lives in ONE place instead of diverging per screen.

import { useEffect, useRef, useState } from "react";
import type { UserLight } from "@repo/core/types/light";

export function useLevelUp(userLight: UserLight | undefined) {
  const prevTier = useRef<number | null>(null);
  const [levelUpTier, setLevelUpTier] = useState<number | null>(null);

  useEffect(() => {
    if (!userLight) return;
    if (prevTier.current !== null && userLight.currentTier > prevTier.current) {
      setLevelUpTier(userLight.currentTier);
    }
    prevTier.current = userLight.currentTier;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLight?.currentTier]);

  return { levelUpTier, dismiss: () => setLevelUpTier(null) };
}
