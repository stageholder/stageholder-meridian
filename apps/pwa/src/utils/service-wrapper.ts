import { createAuthenticatedFetch } from "@stageholder/sdk/spa";
import { MERIDIAN_PAYWALL_EVENT } from "@/components/paywall-listener";

interface Api402Body {
  code: string;
  feature: string;
  featureLabel?: string;
  limit: number;
  current: number;
  suggestedPlan?: string;
  suggestedPlanName?: string;
}

interface RequestConfig {
  params?: Record<string, unknown>;
  signal?: AbortSignal;
  /** Body for DELETE — axios shape kept for source-compat. */
  data?: unknown;
}

export interface Envelope<T> {
  data: T;
  status: number;
  headers: Headers;
}

export class ServiceError<T = unknown> extends Error {
  /**
   * Axios-shaped `.response` field — existing call sites that match on
   * `error?.response?.status === 402` (paywall) or `=== 401` (session)
   * continue working without changes.
   */
  public readonly response: { status: number; data: T; headers: Headers };

  constructor(
    message: string,
    response: { status: number; data: T; headers: Headers },
  ) {
    super(message);
    this.name = "ServiceError";
    this.response = response;
  }
}

// One module-level fetch wrapper. The SDK provider binds it on mount;
// requests fired before mount throw a clear error from the SDK itself.
const authFetch = createAuthenticatedFetch({
  onSessionExpired: () => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path === "/auth/login" || path.startsWith("/auth/")) return;
    window.location.href = `/auth/login?returnTo=${encodeURIComponent(path + window.location.search)}`;
  },
});

export class ServiceWrapper {
  constructor(private readonly baseUrl: string) {}

  // Default T = any to match axios behavior. Existing call sites use
  // `apiClient.get('/path')` without an explicit type and destructure
  // `.data` directly; keeping the default permissive avoids churn across
  // ~20 hook modules. Strict consumers can still pass <T> explicitly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get<T = any>(
    path: string,
    config: RequestConfig = {},
  ): Promise<Envelope<T>> {
    return this.request<T>("GET", path, undefined, config);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async post<T = any>(
    path: string,
    data?: unknown,
    config: RequestConfig = {},
  ): Promise<Envelope<T>> {
    return this.request<T>("POST", path, data, config);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async put<T = any>(
    path: string,
    data?: unknown,
    config: RequestConfig = {},
  ): Promise<Envelope<T>> {
    return this.request<T>("PUT", path, data, config);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async patch<T = any>(
    path: string,
    data?: unknown,
    config: RequestConfig = {},
  ): Promise<Envelope<T>> {
    return this.request<T>("PATCH", path, data, config);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async delete<T = any>(
    path: string,
    config: RequestConfig = {},
  ): Promise<Envelope<T>> {
    return this.request<T>("DELETE", path, config.data, config);
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    config: RequestConfig,
  ): Promise<Envelope<T>> {
    const base = this.baseUrl.replace(/\/$/, "");
    const url = new URL(base + (path.startsWith("/") ? path : `/${path}`));
    if (config.params) {
      for (const [k, v] of Object.entries(config.params)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const headers = new Headers({ "Content-Type": "application/json" });
    const init: RequestInit = { method, signal: config.signal, headers };
    if (body !== undefined && method !== "GET" && method !== "HEAD") {
      init.body = JSON.stringify(body);
    }

    const res = await authFetch(url.toString(), init);
    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const data = isJson
      ? ((await res.json()) as unknown)
      : ((await res.text()) as unknown);

    if (res.status === 402 && typeof window !== "undefined") {
      const raw = (data ?? {}) as Partial<Api402Body>;
      const detail: Api402Body = {
        code: raw.code ?? "feature_limit",
        feature: raw.feature ?? "unknown",
        featureLabel: raw.featureLabel,
        limit: raw.limit ?? 0,
        current: raw.current ?? 0,
        suggestedPlan: raw.suggestedPlan,
        suggestedPlanName: raw.suggestedPlanName,
      };
      window.dispatchEvent(new CustomEvent(MERIDIAN_PAYWALL_EVENT, { detail }));
    }

    if (!res.ok) {
      throw new ServiceError(`${method} ${path} failed: ${res.status}`, {
        status: res.status,
        data: data as T,
        headers: res.headers,
      });
    }

    return { data: data as T, status: res.status, headers: res.headers };
  }
}
