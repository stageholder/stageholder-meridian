"use client";

import { useEffect } from "react";
import { logger } from "@repo/core/platform/logger";

export function LogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    logger.initGlobalErrorCapture();
  }, []);

  return <>{children}</>;
}
