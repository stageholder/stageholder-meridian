import { useEffect } from "react";
import { isDesktop } from "@repo/core/platform";
import { checkForUpdate } from "@/lib/check-for-updates";

export function UpdateChecker() {
  useEffect(() => {
    if (!isDesktop()) return;
    void checkForUpdate();
    const interval = setInterval(() => void checkForUpdate(), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
