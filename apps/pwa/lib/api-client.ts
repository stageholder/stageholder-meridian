import { createApiClient } from "@repo/core/api/client";
import { LocalStorageAdapter, detectPlatform } from "@repo/core/platform";
import { MERIDIAN_PAYWALL_EVENT } from "@/components/paywall-listener";

const storage = new LocalStorageAdapter();
export const isDesktop = detectPlatform() === "desktop";

/**
 * Shape the Meridian API returns inside a 402 Payment Required body.
 * Mirrored on the listener side in `components/paywall-listener.tsx`.
 */
interface Api402Body {
  code: string;
  feature: string;
  featureLabel?: string;
  limit: number;
  current: number;
  suggestedPlan?: string;
  suggestedPlanName?: string;
}

/**
 * Web: calls go to the same-origin BFF proxy at `/api/v1/*`, which injects
 * the OIDC access token from the iron-session cookie. No Authorization
 * header is needed client-side; the session cookie travels via
 * `credentials: include` and the BFF refreshes tokens transparently.
 *
 * Desktop: calls go directly to the Meridian API with a Bearer token
 * sourced from `lib/oidc-tauri.ts` (which performs OIDC-spec refresh-token
 * rotation against the Hub via tauri-plugin-store-backed storage). The
 * interceptors below override the base client's bearer behavior to use
 * the Tauri helper instead of LocalStorage, and on 401 they drop the
 * local session so DesktopAuthBoot re-prompts.
 */
const apiClient = createApiClient({
  apiBaseUrl: isDesktop
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
    : "/api/v1",
  authStrategy: isDesktop ? "bearer" : "cookie",
  storage,
  onLogout: async () => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path === "/auth/login" || path.startsWith("/auth/")) return;
    if (isDesktop) {
      try {
        const { signOutTauri } = await import("@/lib/oidc-tauri");
        await signOutTauri();
      } catch {
        /* ignore */
      }
      window.location.href = "/";
      return;
    }
    // Don't POST /auth/logout from here — the SDK route requires the
    // X-Stageholder-CSRF header which we can't read outside React. The
    // redirect to /auth/login is enough: if the Hub session is still alive,
    // silent SSO mints new tokens (overwriting the stale session cookie); if
    // it isn't, the user re-authenticates normally.
    const { toast } = await import("sonner").catch(() => ({
      toast: null as any,
    }));
    if (toast) {
      toast.error("Session expired", {
        description: "Please sign in again.",
      });
    }
    window.location.href = `/auth/login?returnTo=${encodeURIComponent(path)}`;
  },
});

// Paywall interceptor — runs on BOTH web and desktop. When the Meridian API
// returns 402 Payment Required (over a feature limit), parse the structured
// body and dispatch a window event. `<PaywallListener>` picks it up and opens
// the SDK's `<PaywallModal>`. The Promise.reject is preserved so calling code
// (mutations, queries) still goes down its error path — but the user sees the
// upgrade modal first instead of just a generic "failed" toast.
if (typeof window !== "undefined") {
  apiClient.interceptors.response.use(
    (r) => r,
    (error) => {
      if (error?.response?.status === 402) {
        // axios may give us the body as parsed JSON OR as a raw string
        // depending on content-type and any responseType overrides on the
        // request. Handle both so we never lose the feature/limit info.
        let parsed: Partial<Api402Body> | undefined;
        const raw = error.response.data;
        if (raw && typeof raw === "object") {
          parsed = raw as Partial<Api402Body>;
        } else if (typeof raw === "string" && raw.length > 0) {
          try {
            parsed = JSON.parse(raw) as Partial<Api402Body>;
          } catch {
            console.warn(
              "[paywall] 402 body was a string but not JSON:",
              raw.slice(0, 200),
            );
          }
        }
        if (!parsed) {
          console.warn(
            "[paywall] 402 with no parseable body — falling back to generic paywall.",
            error.response,
          );
        }
        const detail: Api402Body = {
          code: parsed?.code ?? "feature_limit",
          feature: parsed?.feature ?? "unknown",
          featureLabel: parsed?.featureLabel,
          limit: parsed?.limit ?? 0,
          current: parsed?.current ?? 0,
          suggestedPlan: parsed?.suggestedPlan,
          suggestedPlanName: parsed?.suggestedPlanName,
        };
        window.dispatchEvent(
          new CustomEvent(MERIDIAN_PAYWALL_EVENT, { detail }),
        );
      }
      return Promise.reject(error);
    },
  );
}

if (isDesktop && typeof window !== "undefined") {
  // Dynamic import keeps Tauri-only modules out of the web SSR bundle.
  void import("@/lib/oidc-tauri").then(
    ({ getAccessTokenTauri, signOutTauri }) => {
      // Attach Bearer on every request from the Tauri-backed token helper,
      // overriding the LocalStorage-backed token the base client would use.
      apiClient.interceptors.request.use(async (reqConfig) => {
        try {
          const token = await getAccessTokenTauri();
          if (token) {
            reqConfig.headers.set?.("Authorization", `Bearer ${token}`);
            // Axios v1 normally gives us an AxiosHeaders instance with .set,
            // but fall through to a plain mutation for defensive safety.
            if (typeof (reqConfig.headers as any)?.set !== "function") {
              (reqConfig.headers as any) = {
                ...((reqConfig.headers as any) ?? {}),
                Authorization: `Bearer ${token}`,
              };
            }
          }
        } catch {
          /* fall through; request proceeds unauthenticated, server will 401 */
        }
        return reqConfig;
      });

      // On 401 from the upstream API, drop the local session and let
      // DesktopAuthBoot render the sign-in screen on reload. Runs before
      // the base client's onLogout to keep desktop sign-out Tauri-native.
      apiClient.interceptors.response.use(
        (r) => r,
        async (error) => {
          if (error?.response?.status === 401) {
            try {
              await signOutTauri();
            } catch {
              /* ignore */
            }
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }
          return Promise.reject(error);
        },
      );
    },
  );
}

export default apiClient;
