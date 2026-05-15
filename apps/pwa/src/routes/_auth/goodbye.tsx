import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/goodbye")({
  component: GoodbyePage,
});

// AuthShell + styled illustration land in Phase 3 along with the rest of
// the auth surface. The cross-tab logout broadcast moves with the file —
// see Phase 7 sweep when src/lib/auth-broadcast.ts lands.
function GoodbyePage() {
  useEffect(() => {
    // Fire the cross-tab broadcast only after we've landed on /goodbye —
    // peer tabs hard-navigating to /auth/login before Hub finishes the
    // end-session flow would otherwise silent-SSO straight back in.
    // The full announceLogout helper lands when lib/auth-broadcast.ts
    // moves into src/ in Phase 7. Inline shim here keeps the channel name
    // identical so cross-tab ordering survives the cutover.
    try {
      const channel = new BroadcastChannel("meridian-auth");
      channel.postMessage({ type: "logout" });
      channel.close();
    } catch {
      /* BroadcastChannel unsupported (older browsers) — degrade silently. */
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Signed out</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You&rsquo;ve been signed out of Meridian. See you next time.
        </p>
        <a
          href="/auth/login"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in again
        </a>
      </div>
    </div>
  );
}
