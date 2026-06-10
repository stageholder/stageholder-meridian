// apps/mobile/app/(authed)/settings.tsx
//
// Settings — native mirror of the PWA's /settings page (apps/pwa/src/routes/
// _app/settings/index.tsx): the same three tabs over the same SHARED views.
//
//   Profile — @repo/features/settings ProfileForm (display name + timezone),
//             read via Hub GET /api/account/profile (lib/api/hub), written via
//             the SDK's native useUpdateProfile (refreshes the session so
//             useUser's name updates everywhere).
//   Targets — @repo/features/settings TargetsSettings (daily todo / journal
//             word targets), wired to the Meridian API light hooks.
//   Account — billing & subscription entry (native /billing screen) + Hub
//             security page via the system browser (password, MFA, sessions,
//             deletion are Hub surfaces on every platform — the PWA links out
//             the same way).
//
// No Appearance section: dark/light lives in the bottom-nav Profile sheet
// (the PWA puts it in the same account menu) — keeping it here too was
// redundant. Sign-out also lives in that sheet, like the PWA's menu.

import {
  Button,
  Card,
  Paragraph,
  ScrollView,
  SizableText,
  Separator,
  Tabs,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import { ProfileForm, TargetsSettings } from "@repo/features/settings";
import { openURL } from "@repo/core/platform/linking";
import { useUpdateProfile } from "@stageholder/sdk/react-native";
import {
  ArrowRight,
  CreditCard,
  ExternalLink,
  Target,
  User,
} from "@tamagui/lucide-icons-2";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BOTTOM_NAV_CLEARANCE } from "@/components/mobile-bottom-nav";
import { useUpdateTargets, useUserLight } from "@/lib/api";
import { useHubProfile } from "@/lib/api/hub";

const HUB_URL =
  process.env.EXPO_PUBLIC_STAGEHOLDER_ISSUER_URL ??
  "https://id.stageholder.com";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "targets", label: "Targets", icon: Target },
  { id: "account", label: "Account", icon: CreditCard },
] as const;

// Strip the kit Tabs.Content default card (bg/border/padding/margin) so the
// panel reads flat — the section components own their own spacing. Same
// constant as the PWA settings page.
const FLAT_CONTENT = {
  bg: "transparent",
  borderWidth: 0,
  p: 0,
  mt: 0,
} as const;

/** PWA's ProfileForm wrapper, mobile edition: Hub profile read + SDK write. */
function ProfileSection() {
  const { data: profile, isLoading } = useHubProfile();
  const update = useUpdateProfile();

  return (
    <ProfileForm
      initialName={profile?.displayName ?? ""}
      initialTimezone={profile?.timezone ?? ""}
      isLoading={isLoading}
      onSubmit={async (data) => {
        await update.mutateAsync(data);
      }}
    />
  );
}

/** PWA's TargetsSettings wrapper, mobile edition — same light API hooks. */
function TargetsSection() {
  const { data: userLight, isLoading } = useUserLight();
  const updateTargets = useUpdateTargets();

  return (
    <TargetsSettings
      initialTodoTarget={userLight?.todoTargetDaily}
      initialJournalTarget={userLight?.journalTargetDailyWords}
      isLoading={isLoading}
      onSubmit={async (data) => {
        await updateTargets.mutateAsync(data);
      }}
    />
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // app.json's expo.version is the user-facing version string.
  const appVersion = Constants.expoConfig?.version ?? "—";

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          // Clearance for the floating BottomNav capsule (PWA shell parity).
          contentContainerStyle={{
            pb: BOTTOM_NAV_CLEARANCE + insets.bottom,
          }}
        >
          <YStack gap="$4" px="$4" pt="$4" pb="$10">
            <Text fontSize="$8" fontWeight="700" color="$color">
              Settings
            </Text>

            {/* Horizontal underline tabs — the PWA's sub-md presentation of
                the same three sections. */}
            <Tabs
              defaultValue="profile"
              orientation="horizontal"
              variant="underline"
            >
              <YStack gap="$4" items="flex-start" width="100%">
                <Tabs.List
                  flexDirection="row"
                  width="100%"
                  shrink={0}
                  gap="$1"
                  bg="transparent"
                  borderWidth={0}
                  p={0}
                >
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <Tabs.Tab key={tab.id} value={tab.id} justify="center">
                        <XStack items="center" gap="$2">
                          <Icon size={16} />
                          <SizableText>{tab.label}</SizableText>
                        </XStack>
                      </Tabs.Tab>
                    );
                  })}
                </Tabs.List>

                <YStack width="100%" minW={0}>
                  <Tabs.Content value="profile" {...FLAT_CONTENT}>
                    <ProfileSection />
                  </Tabs.Content>
                  <Tabs.Content value="targets" {...FLAT_CONTENT}>
                    <TargetsSection />
                  </Tabs.Content>
                  <Tabs.Content value="account" {...FLAT_CONTENT}>
                    <YStack gap="$4">
                      <Paragraph fontSize="$3" color="$mutedForeground">
                        Your billing and subscription live in-app. Password,
                        MFA, connected accounts, sessions, and account deletion
                        are managed on Stageholder.
                      </Paragraph>
                      <YStack gap="$2">
                        <Button
                          intent="outline"
                          iconAfter={<ArrowRight size={14} opacity={0.7} />}
                          onPress={() => router.push("/billing")}
                        >
                          Billing & subscription
                        </Button>
                        <Button
                          intent="outline"
                          iconAfter={<ExternalLink size={14} opacity={0.7} />}
                          onPress={() => openURL(`${HUB_URL}/account`)}
                        >
                          Security & sign-in on Stageholder
                        </Button>
                      </YStack>
                    </YStack>
                  </Tabs.Content>
                </YStack>
              </YStack>
            </Tabs>

            {/* ---- About ---- */}
            <YStack gap="$2" pt="$2">
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
                    Journal security — passphrase change and recovery — lives on
                    the web app for now.
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
