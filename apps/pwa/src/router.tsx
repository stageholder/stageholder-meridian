import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export interface AuthSnapshot {
  isAuthenticated: boolean;
  userSub: string | null;
  hasCompletedOnboarding: boolean;
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
