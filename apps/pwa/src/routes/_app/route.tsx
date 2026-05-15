import { Outlet, redirect, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    if (context.auth.isBootstrapping) return;
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
