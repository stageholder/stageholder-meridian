import { useEffect, useRef } from "react";
import { ThemeProvider } from "next-themes";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StageholderSpaProvider, useOrg, useUser } from "@stageholder/sdk/spa";
import { Toaster } from "sonner";
import { router } from "./router";
import { spaConfig } from "./lib/spa-config";
import { useMeridianUserMeta } from "./lib/me-query";
import {
  dispatchLoadingProgress,
  dispatchLoadingReady,
} from "./lib/loading-progress";
import { PaywallProvider } from "./lib/sdk-compat";
import { PaywallListener } from "@/components/paywall-listener";
import { EncryptionStoreInitializer } from "@/components/providers/encryption-store-initializer";
import { LogProvider } from "@/components/shared/log-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

function InnerApp() {
  const { user, isLoading: userLoading } = useUser();
  const { organizations, activeOrgId, setActive } = useOrg();
  const { data: meta, isLoading: metaLoading } = useMeridianUserMeta();

  // Auto-pick the user's personal org on boot. Meridian is personal-only:
  // every Hub user has exactly one personal org auto-provisioned for them,
  // and team orgs are out of scope for this product. The SPA provider
  // doesn't default `activeOrgId` (it only reads it from localStorage on
  // resume), so on a fresh sign-in `useOrg().org` stays null until
  // something explicitly sets it. That breaks every consumer of
  // `useOrg().org` — billing hooks, sdk-compat fetches that scope by
  // orgId, etc.
  //
  // Replaces what the old Next.js BFF's `afterCallback` hook did
  // server-side; same logic, now client-side, runs exactly once per
  // user load. Picks `kind === "personal"` if present, falls back to
  // organizations[0] (which is the personal org for meridian users by
  // definition since this product never provisions any other kind).
  const pickedOrgRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || activeOrgId || organizations.length === 0) return;
    const personal =
      organizations.find((o) => (o as { kind?: string }).kind === "personal") ??
      organizations[0];
    if (personal && pickedOrgRef.current !== personal.id) {
      pickedOrgRef.current = personal.id;
      void setActive(personal.id);
    }
  }, [user, activeOrgId, organizations, setActive]);

  // Bootstrapping = "still loading user" OR "user loaded but meta not yet
  // resolved." Both flags need to land before the `_app` gate can make
  // its redirect decision without flicker.
  const stillLoading = userLoading || (!!user && metaLoading);

  // Gate the *initial* boot so the splash stays up until we have user
  // identity, but never re-gate afterwards. Without this, every
  // `refreshSession()` (e.g. after billing/change-plan) flips userLoading
  // back to true, unmounts the entire RouterProvider, and re-runs every
  // route loader from scratch — which looks like a full page reload to
  // the user. Once we've rendered the router once, keep it mounted and
  // let the SDK hooks update in place.
  const hasBootedRef = useRef(false);
  if (!stillLoading) hasBootedRef.current = true;
  const blockInitialBoot = stillLoading && !hasBootedRef.current;

  // Drive the splash crawl with real signals: SDK loading → "Restoring
  // session", post-user meta load → "Preparing workspace", everything
  // settled → "Almost ready" (the splash's RAF tween handles the last
  // hop to 100% when dispatchLoadingReady fires below).
  useEffect(() => {
    if (userLoading) {
      dispatchLoadingProgress(72, "Restoring session");
    } else if (user && metaLoading) {
      dispatchLoadingProgress(84, "Preparing workspace");
    } else {
      dispatchLoadingProgress(96, "Almost ready");
    }
  }, [userLoading, metaLoading, user]);

  // Wait one RAF after the initial boot lands so the router has a chance
  // to render its first frame *behind* the splash before we fade it out.
  // Without the RAF, fade-out can race the first paint and the user sees
  // a frame of blank background.
  useEffect(() => {
    if (blockInitialBoot) return;
    const handle = requestAnimationFrame(() => dispatchLoadingReady());
    return () => cancelAnimationFrame(handle);
  }, [blockInitialBoot]);

  if (blockInitialBoot) return null;

  return (
    <RouterProvider
      router={router}
      context={{
        auth: {
          isAuthenticated: !!user,
          userSub: user?.sub ?? null,
          hasCompletedOnboarding: meta?.hasCompletedOnboarding ?? false,
          isBootstrapping: false,
        },
      }}
    />
  );
}

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <StageholderSpaProvider productSlug="meridian" config={spaConfig}>
          {/*
           * PaywallProvider: SPA-compatible replacement for the SDK's
           * `/react` usePaywall (which is unreachable under SPA — the SDK
           * has a dual-package hazard between `/react` and `/spa` contexts).
           * Owns the meridian:paywall event subscription + open/close state.
           *
           * PaywallListener: paints the modal off the controller state.
           *
           * EncryptionStoreInitializer: hydrates journal-encryption store
           * from OIDC `sub` once authenticated; drops queued offline
           * mutations from any previously signed-in user.
           *
           * LogProvider: installs the platform logger's global error capture.
           */}
          <PaywallProvider>
            <PaywallListener>
              <EncryptionStoreInitializer>
                <LogProvider>
                  <InnerApp />
                </LogProvider>
              </EncryptionStoreInitializer>
            </PaywallListener>
          </PaywallProvider>
          <Toaster />
        </StageholderSpaProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
