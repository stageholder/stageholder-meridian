// Google Consent Mode v2 + the consent cookie shared by every *.stageholder.com
// app (portal, hub, Atlas, Meridian, Almanac). CONSENT_INIT_SCRIPT must run
// BEFORE the GTM container loads, so the root layout injects it as a
// `beforeInteractive` next/script.
//
// Defaults: visitors in the EEA, UK and Switzerland start with every
// non-essential category denied until they choose in the cookie banner (GDPR).
// Everyone else starts granted and can opt out from the same banner. A saved
// choice is re-applied synchronously on every page load, before GTM reads the
// consent state.
//
// Keep this file identical (modulo formatting) to lib/analytics/consent.ts in
// stageholder-portal: the shared cookie name and JSON shape are what let one
// choice follow the user from stageholder.com to the hub and into the apps.

export type ConsentKey =
  | "ad_storage"
  | "ad_user_data"
  | "ad_personalization"
  | "analytics_storage"
  | "functionality_storage"
  | "personalization_storage"
  | "security_storage";

export type ConsentState = Record<ConsentKey, "granted" | "denied">;

export const CONSENT_KEYS: readonly ConsentKey[] = [
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "analytics_storage",
  "functionality_storage",
  "personalization_storage",
  "security_storage",
];

export const CONSENT_COOKIE_NAME = "STAGEHOLDER_CONSENT";
const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const CONSENT_COOKIE_DOMAIN = "stageholder.com";

// ISO 3166-1 alpha-2 codes that start denied: EU/EEA + UK + Switzerland.
const CONSENT_REQUIRED_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO",
  "SK", "SI", "ES", "SE", "GB", "CH",
];

export const ESSENTIAL_ONLY: ConsentState = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "granted",
  personalization_storage: "denied",
  security_storage: "granted",
};

export const ALL_GRANTED: ConsentState = {
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
  analytics_storage: "granted",
  functionality_storage: "granted",
  personalization_storage: "granted",
  security_storage: "granted",
};

/** Dispatched on window to reopen the cookie preferences dialog. */
export const OPEN_COOKIE_SETTINGS_EVENT = "stageholder:open-cookie-settings";

// Inline script source (ES5 — it runs before any bundle). Region-specific
// default first, then the global default, then the saved choice if any.
export const CONSENT_INIT_SCRIPT = [
  "window.dataLayer=window.dataLayer||[];",
  "function gtag(){dataLayer.push(arguments);}",
  "window.gtag=window.gtag||gtag;",
  `gtag('consent','default',${JSON.stringify({ ...ESSENTIAL_ONLY, region: CONSENT_REQUIRED_REGIONS, wait_for_update: 500 })});`,
  `gtag('consent','default',${JSON.stringify(ALL_GRANTED)});`,
  "gtag('set','url_passthrough',true);",
  "gtag('set','ads_data_redaction',true);",
  `try{var m=document.cookie.match(/(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)/);`,
  `if(m){var c=JSON.parse(decodeURIComponent(m[1])),u={},k=${JSON.stringify(CONSENT_KEYS)};`,
  "for(var i=0;i<k.length;i++){if(c[k[i]]==='granted'||c[k[i]]==='denied')u[k[i]]=c[k[i]];}",
  "gtag('consent','update',u);}}catch(e){}",
].join("");

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

/** The visitor's saved choice, or null if they haven't chosen yet. */
export function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    const saved = JSON.parse(decodeURIComponent(match[1])) as Partial<ConsentState>;
    const state: ConsentState = { ...ESSENTIAL_ONLY };
    for (const key of CONSENT_KEYS) {
      if (saved[key] === "granted" || saved[key] === "denied") state[key] = saved[key];
    }
    return state;
  } catch {
    return null;
  }
}

/** Persist the choice for every *.stageholder.com app and tell Google now. */
export function saveConsent(state: ConsentState): void {
  if (typeof document === "undefined") return;
  const { hostname, protocol } = window.location;
  const sharedDomain =
    hostname === CONSENT_COOKIE_DOMAIN || hostname.endsWith(`.${CONSENT_COOKIE_DOMAIN}`)
      ? `; domain=.${CONSENT_COOKIE_DOMAIN}`
      : "";
  const secure = protocol === "https:" ? "; secure" : "";
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(state))}; max-age=${CONSENT_COOKIE_MAX_AGE}; path=/; samesite=lax${sharedDomain}${secure}`;
  (window as GtagWindow).gtag?.("consent", "update", state);
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}
