// apps/mobile/app/sign-in.tsx
//
// Sign-in screen. OIDC code+PKCE flow via the system browser, driven entirely
// by @stageholder/sdk/react-native's useSignIn(). Structure mirrors the
// Almanac login screen (stageholder-almanac apps/mobile/app/(auth)/login.tsx):
// app icon · title · subtitle, then the Stageholder-branded primary sign-in,
// an outline Sign up, and a ghost Forgot password. All three entry points open
// the SAME hosted Identity Hub flow — the Hub page handles login, account
// creation, and password reset; the RN SDK exposes only `signIn()`.
//
// The StageholderLogo on the primary button is the kit's first-party brand
// mark (transparent ink, base64-embedded in @stageholder/ui) — variant="dark"
// is the white-ink mark for the brand-filled button, NOT the navy tile.

import {
  SignInCancelledError,
  useSignIn,
  useStageholder,
} from "@stageholder/sdk/react-native";
import {
  Banner,
  Button,
  H1,
  Paragraph,
  Spinner,
  XStack,
  YStack,
} from "@stageholder/ui";
import { StageholderLogo } from "@stageholder/ui/brand";
import { UserPlus } from "@tamagui/lucide-icons-2/icons/UserPlus";
import { openURL } from "@repo/core/platform/linking";
import { Redirect } from "expo-router";
import { Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { hubOrigin } from "@/lib/api/hub";

// Meridian's own brand mark — Stageholder is the identity provider we sign in
// *through*, so the app's logo owns the header and the Stageholder mark stays
// on the identity button (same split as Almanac).
const MERIDIAN_LOGO = require("../assets/icon.png");

export default function SignInScreen() {
  const { state } = useStageholder();
  const { signIn, isLoading, error } = useSignIn();

  // While the provider is hydrating its session from SecureStore we don't yet
  // know if the user is signed in — show a spinner rather than flashing the
  // sign-in CTA at an already-authenticated user.
  if (state.status === "loading") {
    return (
      <YStack flex={1} bg="$background" items="center" justify="center">
        <Spinner size="large" />
      </YStack>
    );
  }
  if (state.status === "authenticated") {
    return <Redirect href="/" />;
  }

  // User-cancelled sign-in is expected, not an error — leave the screen as-is.
  const showError = error && !(error instanceof SignInCancelledError);

  // Sign-in and forgot-password open the hosted Hub login page (which carries
  // its own reset link). Sign up passes `promptCreate` (SDK alpha.65) — the
  // standard OIDC `prompt=create` — so the Hub renders the REGISTRATION page
  // directly and completing it continues the same PKCE flow, signed in. An
  // already-authenticated user SSO-continues untouched (documented Hub
  // behavior), so the flag is safe on every press.
  function handleAuth(options?: { promptCreate?: boolean }) {
    signIn(options).catch((e) => {
      if (e instanceof SignInCancelledError) return;
      // Anything else surfaces via the `error` field below.
    });
  }

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} px="$6" justify="center" gap="$6">
          <YStack items="center" gap="$3">
            <Image
              source={MERIDIAN_LOGO}
              style={{ width: 80, height: 80, borderRadius: 20 }}
              resizeMode="contain"
            />
            <H1 color="$color12" text="center">
              Meridian
            </H1>
            <Paragraph
              fontSize="$3"
              color="$color11"
              lineHeight="$3"
              text="center"
            >
              Habits, todos, and journaling — all in one place. Sign in with
              your Stageholder account to continue.
            </Paragraph>
          </YStack>

          <YStack gap="$3">
            <Button
              intent="primary"
              size="lg"
              width="100%"
              icon={<StageholderLogo variant="dark" size={20} />}
              loading={isLoading}
              loadingText="Opening sign-in…"
              onPress={() => handleAuth()}
            >
              Sign in with Stageholder
            </Button>
            <Button
              intent="outline"
              size="lg"
              width="100%"
              icon={<UserPlus size={20} />}
              disabled={isLoading}
              onPress={() => handleAuth({ promptCreate: true })}
            >
              Sign up
            </Button>
            <XStack justify="center">
              {/* Straight to the Hub's reset page — it used to start the
                  same sign-in flow as the button above. */}
              <Button
                intent="ghost"
                disabled={isLoading}
                onPress={() => {
                  try {
                    openURL(`${hubOrigin()}/auth/forgot-password`);
                  } catch {
                    handleAuth();
                  }
                }}
              >
                Forgot password?
              </Button>
            </XStack>

            {showError ? (
              <Banner intent="danger">
                <Banner.Body>
                  <Banner.Title>Sign-in failed</Banner.Title>
                  <Banner.Description>{error.message}</Banner.Description>
                </Banner.Body>
              </Banner>
            ) : null}
          </YStack>

          <Paragraph fontSize={11} color="$color10" text="center">
            Stageholder handles auth. We never see your password.
          </Paragraph>
        </YStack>
      </SafeAreaView>
    </YStack>
  );
}
