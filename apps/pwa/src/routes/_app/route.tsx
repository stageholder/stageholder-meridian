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
    // Redirect ONLY when we positively know onboarding isn't done. `null`
    // (unresolved — `/me` still loading or failed) must NOT force onboarding:
    // that's the bug where a flaky API dumped authenticated users into the
    // onboarding flow. A genuinely-new user resolves to `false` and is sent
    // through onboarding; everyone else stays where they are.
    if (context.auth.hasCompletedOnboarding === false) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
