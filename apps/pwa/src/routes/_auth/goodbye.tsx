import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, H1, Paragraph, YStack } from "@stageholder/ui";

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
    <YStack minH={"100vh" as never} items="center" justify="center" px="$6">
      <YStack maxW={448} items="center">
        <H1 fontSize="$7" fontWeight="600" letterSpacing={-0.5} text="center">
          Signed out
        </H1>
        <Paragraph mt="$3" fontSize="$3" color="$mutedForeground" text="center">
          You&rsquo;ve been signed out of Meridian. See you next time.
        </Paragraph>
        <Link
          to="/auth/login"
          style={{ textDecoration: "none", marginTop: 24 }}
        >
          <Button>Sign in again</Button>
        </Link>
      </YStack>
    </YStack>
  );
}
