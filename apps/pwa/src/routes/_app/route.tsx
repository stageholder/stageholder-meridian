import { Outlet, redirect, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    if (context.auth.isBootstrapping) return;

    // Offline grace: when the browser is offline, the Hub is unreachable for
    // (re)authentication AND /auth/login is network-only, so an expired
    // session would lock the user out of their fully-cached Dexie data.
    // Skip the auth/onboarding redirects while offline and let the route
    // render against local data. Online behavior is unchanged.
    const isOffline =
      typeof navigator !== "undefined" && navigator.onLine === false;
    if (isOffline) return;

    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/auth/login",
        search: { returnTo: location.href },
      });
    }
    if (!context.auth.hasCompletedOnboarding) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
