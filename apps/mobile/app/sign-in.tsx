// apps/mobile/app/sign-in.tsx
//
// Sign-in screen. OIDC code+PKCE flow via the system browser, driven entirely
// by @stageholder/sdk/react-native's useSignIn(). Restyled with @stageholder/ui
// primitives so it shares the observatory aesthetic with the rest of the app.
// One CTA, calm copy, error surface only when relevant.

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
  YStack,
} from "@stageholder/ui";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

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

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }}>
        <YStack flex={1} px="$6" justify="center" gap="$5">
          <YStack gap="$2">
            <Paragraph
              fontFamily="$mono"
              fontSize={11}
              letterSpacing={2.4}
              textTransform="uppercase"
              color="$color11"
            >
              Meridian
            </Paragraph>
            <H1 color="$color12" lineHeight="$11">
              Light, kept.
            </H1>
            <Paragraph fontSize="$3" color="$color11" lineHeight="$3">
              Habits, todos, and journaling — all in one place. Track the things
              that move you forward.
            </Paragraph>
          </YStack>

          <YStack gap="$3" pt="$4">
            <Button
              intent="primary"
              size="lg"
              loading={isLoading}
              loadingText="Opening browser…"
              onPress={() => {
                signIn().catch((e) => {
                  if (e instanceof SignInCancelledError) return;
                  // Anything else surfaces via the `error` field below.
                });
              }}
            >
              Continue with Stageholder
            </Button>

            {showError ? (
              <Banner intent="danger">
                <Banner.Title>Sign-in failed</Banner.Title>
                <Banner.Description>{error.message}</Banner.Description>
              </Banner>
            ) : null}
          </YStack>

          <Paragraph fontSize={11} color="$color10" text="center" pt="$8">
            Stageholder handles auth. We never see your password.
          </Paragraph>
        </YStack>
      </SafeAreaView>
    </YStack>
  );
}
