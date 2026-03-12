"use client";

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
