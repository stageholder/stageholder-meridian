import { isTauri } from "@stageholder/sdk/tauri";

/** Google Tag Manager container (GTM-XXXXXXX), baked in at build time. */
export const GTM_ID: string = import.meta.env.VITE_GTM_ID || "";

// Every *.stageholder.com app reports into one GA4 property; app_name is the
// custom dimension that tells them apart.
export const APP_NAME = "meridian";

/**
 * Analytics runs only in the hosted web app: a production build with a
 * container id, outside the Tauri desktop shell. The desktop build compiles
 * this same bundle, so the runtime check matters.
 */
export function isAnalyticsEnabled(): boolean {
  if (!import.meta.env.PROD || !GTM_ID || typeof window === "undefined") return false;
  return !isTauri();
}
