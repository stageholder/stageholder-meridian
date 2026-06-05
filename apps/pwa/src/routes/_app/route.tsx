import { Outlet, redirect, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    if (context.auth.isBootstrapping) return;

    // (There used to be an "offline grace" branch here that skipped the
    // auth/onboarding redirects while `navigator.onLine === false` so the
    // route could render against fully-cached Dexie data. The offline cache
    // is gone — with no local data to fall back to, rendering an
    // unauthenticated shell is strictly worse than redirecting to login, so
    // the gate now always runs.)
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
