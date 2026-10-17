import { useState } from "react";
import { useSignIn } from "@stageholder/sdk/spa";
import {
  Banner,
  Button,
  H1,
  Paragraph,
  StageholderLogo,
  XStack,
  YStack,
} from "@stageholder/ui";
import { ExternalLink, UserPlus } from "@tamagui/lucide-icons-2";
import { openURL } from "@repo/core/platform/linking";
import { MeridianLogo } from "@/components/shared/meridian-logo";

/**
 * Desktop sign-in screen. Mirrors the native app's `apps/mobile/app/sign-in.tsx`
 * (Meridian mark, Stageholder-branded primary button, Sign up, Forgot
 * password): every action opens the hosted Hub page in the SYSTEM browser
 * (`lib/desktop-auth.ts`), and the app finishes signing in when the browser
 * hands back the `meridian://auth/callback` deep link — so after a click this
 * screen waits instead of navigating.
 */
export function DesktopSignIn({ returnTo }: { returnTo: string }) {
  const { signIn, isLoading, error } = useSignIn();
  const [waiting, setWaiting] = useState(false);

  function start(options?: { promptCreate?: boolean }) {
    signIn({ returnTo, ...options }).then(
      () => setWaiting(true),
      () => setWaiting(false), // surfaced via `error`
    );
  }

  const hubWeb = (import.meta.env.VITE_HUB_WEB_URL ?? "").replace(/\/+$/, "");

  return (
    <YStack
      minH={"100vh" as never}
      bg="$background"
      items="center"
      justify="center"
      px="$6"
    >
      {/* titleBarStyle "Overlay": no native title bar, so give the window a
          drag handle across the top like the app shell header does. */}
      <div
        data-tauri-drag-region
        style={{ position: "fixed", top: 0, left: 0, right: 0, height: 32 }}
      />
      <YStack width="100%" maxW={400} gap="$6">
        <YStack items="center" gap="$3">
          <MeridianLogo size="lg" />
          <H1 fontSize="$8" fontWeight="600" letterSpacing={-0.5} text="center">
            {waiting ? "Continue in your browser" : "Meridian"}
          </H1>
          <Paragraph fontSize="$3" color="$mutedForeground" text="center">
            {waiting
              ? "We opened Stageholder in your browser. Finish signing in there and Meridian will open automatically."
              : "Habits, todos, and journaling — all in one place. Sign in with your Stageholder account to continue."}
          </Paragraph>
        </YStack>

        {waiting ? (
          <YStack gap="$3">
            <Button
              intent="primary"
              size="lg"
              width="100%"
              icon={<ExternalLink size={18} />}
              loading={isLoading}
              onPress={() => start()}
            >
              Open the browser again
            </Button>
            <Button intent="ghost" onPress={() => setWaiting(false)}>
              Back
            </Button>
          </YStack>
        ) : (
          <YStack gap="$3">
            <Button
              intent="primary"
              size="lg"
              width="100%"
              icon={<StageholderLogo variant="dark" size={20} />}
              loading={isLoading}
              loadingText="Opening your browser…"
              onPress={() => start()}
            >
              Sign in with Stageholder
            </Button>
            <Button
              intent="outline"
              size="lg"
              width="100%"
              icon={<UserPlus size={20} />}
              disabled={isLoading}
              onPress={() => start({ promptCreate: true })}
            >
              Sign up
            </Button>
            {hubWeb ? (
              <XStack justify="center">
                <Button
                  intent="ghost"
                  disabled={isLoading}
                  onPress={() => openURL(`${hubWeb}/auth/forgot-password`)}
                >
                  Forgot password?
                </Button>
              </XStack>
            ) : null}
          </YStack>
        )}

        {error ? (
          <Banner intent="danger">
            <Banner.Body>
              <Banner.Title>Couldn&rsquo;t open sign-in</Banner.Title>
              <Banner.Description>{error.message}</Banner.Description>
            </Banner.Body>
          </Banner>
        ) : null}

        <Paragraph fontSize={11} color="$mutedForeground" text="center">
          Stageholder handles sign-in. Meridian never sees your password.
        </Paragraph>
      </YStack>
    </YStack>
  );
}
