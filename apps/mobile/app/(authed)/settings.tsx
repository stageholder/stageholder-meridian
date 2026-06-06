// apps/mobile/app/(authed)/settings.tsx
//
// Settings — the focused mobile subset. Four blocks:
//
//   1. Appearance — light / dark / system, wired to the cross-platform theme
//      store (lib/platform/theme). A SegmentedControl maps cleanly to three
//      mutually-exclusive choices.
//   2. Account — name + email + avatar from the SDK's useUser() identity.
//   3. Sign out — the SDK provider's signOut() (drops the session; the root
//      layout's onSignedOut redirects to /sign-in).
//   4. About — app version from expo-constants, plus an honest note that the
//      advanced settings (targets, billing, security) live on the web app.
//
// Deliberately small: profile editing, daily targets, and billing are
// substantial web surfaces (apps/pwa settings) that aren't ported this pass.

import { useState } from "react";
import { useStageholder, useUser } from "@stageholder/sdk/react-native";
import {
  Avatar,
  Button,
  Card,
  Paragraph,
  ScrollView,
  SegmentedControl,
  Select,
  Separator,
  Spinner,
  Text,
  View,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import Constants from "expo-constants";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import { FormSheet } from "@/components/form-sheet";

import { useAppTheme, type ThemePreference } from "@/lib/platform/theme";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/* ---- TEMP: Select isolation test (DELETE AFTER DEBUGGING) ----
   Byte-for-byte the docs-expo "Default" demo: static FRUITS list,
   uncontrolled + controlled, standalone on the screen. */
const TEST_FRUITS = [
  { value: "apple", label: "Apple" },
  { value: "pear", label: "Pear" },
  { value: "orange", label: "Orange" },
  { value: "watermelon", label: "Watermelon" },
  { value: "mango", label: "Mango" },
] as const;

function SelectIsolationTest() {
  const [controlled, setControlled] = useState("pear");
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <YStack
      gap="$3"
      p="$3"
      borderWidth={2}
      borderColor="$destructive"
      rounded="$4"
    >
      <Text fontSize="$2" fontWeight="700" color="$destructive">
        TEMP Select test — dummy data
      </Text>
      {/* Test 2: the SAME dummy select mounted INSIDE a FormSheet — the
          forms' exact mount context, still zero API data. Separates the
          "initial data" theory from the "Select inside FormSheet" theory. */}
      <Button size="sm" onPress={() => setSheetOpen(true)}>
        Open dummy select in FormSheet
      </Button>
      <FormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Dummy sheet"
        description="Same select, inside the forms' sheet."
      >
        <Select value={controlled} onValueChange={setControlled}>
          <Select.Trigger placeholder="In sheet" width="100%" />
          <Select.Content>
            {TEST_FRUITS.map((f) => (
              <Select.Item key={f.value} value={f.value}>
                {f.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </FormSheet>
      <Select defaultValue="pear">
        <Select.Trigger placeholder="Uncontrolled" width="100%" />
        <Select.Content>
          {TEST_FRUITS.map((f) => (
            <Select.Item key={f.value} value={f.value}>
              {f.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
      <Select value={controlled} onValueChange={setControlled}>
        <Select.Trigger placeholder="Controlled" width="100%" />
        <Select.Content>
          {TEST_FRUITS.map((f) => (
            <Select.Item key={f.value} value={f.value}>
              {f.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </YStack>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, isLoading: userLoading } = useUser();
  const { signOut } = useStageholder();
  const { theme, setTheme } = useAppTheme();
  const toast = useToast();

  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      // The root layout's onSignedOut handler redirects to /sign-in once the
      // session is cleared, so we don't navigate manually here.
      await signOut();
    } catch (err) {
      setSigningOut(false);
      toast.show({
        title: "Couldn't sign out",
        message: (err as Error).message ?? "Try again.",
        intent: "danger",
      });
    }
  }

  // app.json's expo.version is the user-facing version string.
  const appVersion = Constants.expoConfig?.version ?? "—";

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          // Clearance for the floating BottomNav capsule (PWA shell parity).
          contentContainerStyle={{
            paddingBottom: BOTTOM_NAV_CLEARANCE + insets.bottom,
          }}
        >
          <YStack gap="$5" px="$4" pt="$4" pb="$10">
            <Text fontSize="$8" fontWeight="700" color="$color">
              Settings
            </Text>

            {/* ---- TEMP: Select isolation test (DELETE AFTER DEBUGGING) ----
                The EXACT docs-expo Select demo (static dummy data, no API, no
                initial, no FormSheet) rendered inside THIS app/binary. If
                this crashes → environment (dev client/binary); if it works →
                the difference is in how the forms wire Select. */}
            <SelectIsolationTest />

            {/* ---- Appearance ---- */}
            <YStack gap="$2">
              <Text
                fontSize="$1"
                fontWeight="600"
                color="$mutedForeground"
                letterSpacing={0.6}
                textTransform="uppercase"
              >
                Appearance
              </Text>
              <Card>
                <Card.Body gap="$3">
                  <Paragraph fontSize="$3" color="$mutedForeground">
                    Choose how Meridian looks. System follows your device.
                  </Paragraph>
                  <SegmentedControl
                    fullWidth
                    value={theme}
                    onValueChange={(v) => setTheme(v as ThemePreference)}
                  >
                    {THEME_OPTIONS.map((opt) => (
                      <SegmentedControl.Item key={opt.value} value={opt.value}>
                        {opt.label}
                      </SegmentedControl.Item>
                    ))}
                  </SegmentedControl>
                </Card.Body>
              </Card>
            </YStack>

            {/* ---- Account ---- */}
            <YStack gap="$2">
              <Text
                fontSize="$1"
                fontWeight="600"
                color="$mutedForeground"
                letterSpacing={0.6}
                textTransform="uppercase"
              >
                Account
              </Text>
              <Card>
                <Card.Body gap="$3">
                  {userLoading && !user ? (
                    <View py="$3" items="center">
                      <Spinner />
                    </View>
                  ) : user ? (
                    <XStack items="center" gap="$3">
                      <Avatar
                        src={user.picture ?? undefined}
                        name={user.name ?? user.email ?? "User"}
                        size="md"
                      />
                      <YStack flex={1} minW={0}>
                        {user.name ? (
                          <Text
                            fontSize="$4"
                            fontWeight="600"
                            color="$color"
                            numberOfLines={1}
                          >
                            {user.name}
                          </Text>
                        ) : null}
                        {user.email ? (
                          <Text
                            fontSize="$2"
                            color="$mutedForeground"
                            numberOfLines={1}
                          >
                            {user.email}
                          </Text>
                        ) : null}
                      </YStack>
                    </XStack>
                  ) : (
                    <Text fontSize="$3" color="$mutedForeground">
                      Not signed in.
                    </Text>
                  )}
                  <Separator />
                  <Button
                    intent="outline"
                    onPress={handleSignOut}
                    loading={signingOut}
                    loadingText="Signing out…"
                  >
                    Sign out
                  </Button>
                </Card.Body>
              </Card>
            </YStack>

            {/* ---- About ---- */}
            <YStack gap="$2">
              <Text
                fontSize="$1"
                fontWeight="600"
                color="$mutedForeground"
                letterSpacing={0.6}
                textTransform="uppercase"
              >
                About
              </Text>
              <Card>
                <Card.Body gap="$3">
                  <XStack items="center" justify="space-between">
                    <Text fontSize="$3" color="$color">
                      Version
                    </Text>
                    <Text fontSize="$3" color="$mutedForeground">
                      {appVersion}
                    </Text>
                  </XStack>
                  <Separator />
                  <Paragraph fontSize="$2" color="$mutedForeground">
                    Advanced settings — daily targets, billing, and journal
                    security — live on the web app.
                  </Paragraph>
                </Card.Body>
              </Card>
            </YStack>
          </YStack>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
}
