import { useEffect } from "react";

import { GTM_ID, isAnalyticsEnabled } from "./config";

/**
 * Loads the GTM container once. Consent Mode defaults are already in place:
 * vite.config.ts inlines CONSENT_INIT_SCRIPT at the top of index.html.
 */
export function GoogleTagManager() {
  useEffect(() => {
    if (!isAnalyticsEnabled() || document.getElementById("gtm-script")) return;

    const w = window as Window & { dataLayer?: Record<string, unknown>[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

    const script = document.createElement("script");
    script.id = "gtm-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
    document.head.appendChild(script);
  }, []);

  return null;
}
