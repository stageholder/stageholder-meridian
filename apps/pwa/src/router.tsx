import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export interface AuthSnapshot {
  isAuthenticated: boolean;
  userSub: string | null;
  /**
   * Tri-state ON PURPOSE: `true`/`false` mean `/me` resolved and we KNOW the
   * onboarding status; `null` means it's unresolved (still loading, or the
   * `/me` call failed). The onboarding gate must only redirect on a positive
   * `false` — never on `null` — so a flaky/slow `/me` can't trap an
   * authenticated user in the onboarding flow.
   */
  hasCompletedOnboarding: boolean | null;
  isBootstrapping: boolean;
}

export interface RouterContext {
  auth: AuthSnapshot;
}

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: { auth: undefined! },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
