// apps/mobile/app/(authed)/(tabs)/settings.tsx
//
// Settings — ONE scrolling grouped list, the iOS Settings / Android
// preferences idiom (it replaced web-style Profile/Targets/Account underline
// tabs plus a separate "Profile" bottom sheet that secretly held Sign out and
// Appearance). Everything account-related lives here now:
//
//   profile header (tap → edit) · Goals · Subscription · Journal security ·
//   Appearance · Progress · Account (Hub web surfaces) · Sign out · version
//
// Editing stays behind FormSheets hosting the SAME shared forms the PWA
// renders (@repo/features/settings + encryption).

import { useEffect, useState } from "react";
import {
  Avatar,
  Banner,
  Button,
  FormSheet,
  SegmentedControl,
  Spinner,
  Text,
  XStack,
  YStack,
  toast,
} from "@stageholder/ui";
import { ProfileForm, TargetsSettings } from "@repo/features/settings";
import { PassphraseChangeForm } from "@repo/features/encryption";
import { openURL } from "@repo/core/platform/linking";
import {
  useEnterprise,
  useOrg,
  useSubscription,
  useUpdateProfile,
  useUser,
} from "@stageholder/sdk/react-native";
import { ChevronRight } from "@tamagui/lucide-icons-2";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenScroll } from "@/components/screen-scroll";
import { SettingsGroup, SettingsRow } from "@/components/settings-list";
import { useUpdateTargets, useUserLight } from "@/lib/api";
import { canManageBilling, hubOrigin, useHubProfile } from "@/lib/api/hub";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import {
  changeJournalPassphrase,
  checkJournalStatus,
  useJournalCrypto,
} from "@/lib/journal-crypto";
import { useAppTheme, type ThemePreference } from "@/lib/platform/theme";

// Hub ORIGIN for web account links. hubOrigin() throws on missing env — never
// crash Settings over a link; fall back to the public host.
const HUB_URL = (() => {
  try {
    return hubOrigin();
  } catch {
    return "https://id.stageholder.com";
  }
})();

type SheetKind = "profile" | "targets" | "passphrase" | null;

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const profileQuery = useHubProfile();
  const updateProfile = useUpdateProfile();
  const lightQuery = useUserLight();
  const updateTargets = useUpdateTargets();
  const { isSetup: journalEncrypted } = useJournalCrypto();
  const sub = useSubscription();
  const enterprise = useEnterprise();
  const { org } = useOrg();
  const { theme, setTheme } = useAppTheme();
  const { confirmSignOut, signingOut } = useSignOut();
  const [sheet, setSheet] = useState<SheetKind>(null);

  // Load the journal's wrapped-key status so the passphrase row is accurate
  // even if the Journal tab hasn't been opened this session.
  useEffect(() => {
    void checkJournalStatus();
  }, []);

  // 404 = fresh account with no Hub profile row yet: seed from the session;
  // the first save creates it.
  const profileStatus = (
    profileQuery.error as { response?: { status?: number } } | null
  )?.response?.status;
  const profileFailed = profileQuery.isError && profileStatus !== 404;
  const displayName = profileQuery.data?.displayName ?? user?.name ?? "";
  const email = profileQuery.data?.email ?? user?.email ?? "";
  const timezone = profileQuery.data?.timezone ?? "";

  const todoTarget = lightQuery.data?.todoTargetDaily;
  const journalTarget = lightQuery.data?.journalTargetDailyWords;

  const planLabel = enterprise ? "Enterprise" : (sub?.planName ?? "Free");
  const isFree = !enterprise && (!sub?.planName || sub.planName === "Free");
  const canManage = canManageBilling(org?.role);

  const appVersion = Constants.expoConfig?.version ?? "—";

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScreenScroll
          refreshing={profileQuery.isRefetching}
          onRefresh={() =>
            Promise.all([profileQuery.refetch(), lightQuery.refetch()])
          }
        >
          <YStack gap="$5" px="$4" pt="$4">
            <Text fontSize="$8" fontWeight="700" color="$color">
              Settings
            </Text>

            {/* ---- Profile header (tap → edit) ---- */}
            {profileFailed ? (
              <Banner intent="danger">
                <Banner.Body>
                  <Banner.Title>Couldn&apos;t load your profile</Banner.Title>
                  <Banner.Action self="flex-end" mt="$2">
                    <Button
                      intent="secondary"
                      size="sm"
                      onPress={() => void profileQuery.refetch()}
                    >
                      Try again
                    </Button>
                  </Banner.Action>
                </Banner.Body>
              </Banner>
            ) : (
              <XStack
                role="button"
                aria-label="Edit profile"
                testID="settings-profile"
                items="center"
                gap="$3"
                p="$3.5"
                bg="$card"
                rounded="$5"
                borderWidth={1}
                borderColor="$borderColor"
                pressStyle={{ bg: "$muted" }}
                onPress={() => setSheet("profile")}
              >
                {profileQuery.isLoading ? (
                  <Spinner />
                ) : (
                  <Avatar
                    src={
                      profileQuery.data?.avatarUrl ?? user?.picture ?? undefined
                    }
                    name={displayName || email || "User"}
                    size="lg"
                  />
                )}
                <YStack flex={1} minW={0}>
                  <Text
                    fontSize="$5"
                    fontWeight="600"
                    color="$color"
                    numberOfLines={1}
                  >
                    {displayName || "Add your name"}
                  </Text>
                  {email ? (
                    <Text
                      fontSize="$2"
                      color="$mutedForeground"
                      numberOfLines={1}
                    >
                      {email}
                    </Text>
                  ) : null}
                  <Text
                    fontSize="$2"
                    color="$mutedForeground"
                    numberOfLines={1}
                  >
                    {timezone || "Timezone not set"}
                  </Text>
                </YStack>
                <ChevronRight size={18} color="$mutedForeground" />
              </XStack>
            )}

            {/* ---- Goals ---- */}
            <SettingsGroup
              title="Daily goals"
              footer="Goals size your Today rings."
            >
              <SettingsRow
                label="Todos"
                value={todoTarget != null ? `${todoTarget} / day` : "—"}
                onPress={() => setSheet("targets")}
              />
              <SettingsRow
                label="Journal words"
                value={journalTarget != null ? `${journalTarget} / day` : "—"}
                onPress={() => setSheet("targets")}
              />
            </SettingsGroup>

            {/* ---- Subscription ---- */}
            <SettingsGroup title="Subscription">
              <SettingsRow
                label="Plan"
                value={planLabel}
                onPress={() => router.push("/billing")}
                testID="settings-plan"
              />
              {isFree && canManage ? (
                <SettingsRow
                  label="Upgrade to Unlimited"
                  onPress={() => router.push("/upgrade")}
                />
              ) : null}
            </SettingsGroup>

            {/* ---- Journal security ---- */}
            <SettingsGroup
              title="Journal"
              footer={
                journalEncrypted
                  ? "Entries are end-to-end encrypted with your passphrase."
                  : "Set up encryption from the Journal tab."
              }
            >
              <SettingsRow
                label="Encryption"
                value={journalEncrypted ? "On" : "Off"}
              />
              {journalEncrypted ? (
                <SettingsRow
                  label="Change passphrase"
                  onPress={() => setSheet("passphrase")}
                />
              ) : null}
            </SettingsGroup>

            {/* ---- Appearance — System / Light / Dark ---- */}
            <SettingsGroup title="Appearance">
              <YStack px="$3" py="$3">
                <SegmentedControl
                  value={theme}
                  onValueChange={(v) => setTheme(v as ThemePreference)}
                >
                  <SegmentedControl.Item value="system">
                    System
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="light">
                    Light
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="dark">
                    Dark
                  </SegmentedControl.Item>
                </SegmentedControl>
              </YStack>
            </SettingsGroup>

            {/* ---- Progress ---- */}
            <SettingsGroup title="Progress">
              <SettingsRow
                label="Your journey"
                onPress={() => router.push("/journey")}
              />
            </SettingsGroup>

            {/* ---- Account (Hub web surfaces) ---- */}
            <SettingsGroup
              title="Stageholder account"
              footer="Password, two-factor, sessions and account deletion are managed on Stageholder."
            >
              <SettingsRow
                label="Password & security"
                external
                onPress={() => openURL(`${HUB_URL}/account/settings/security`)}
              />
              <SettingsRow
                label="Delete account"
                external
                destructive
                onPress={() => openURL(`${HUB_URL}/account/settings/security`)}
              />
            </SettingsGroup>

            <SettingsGroup>
              <SettingsRow
                label={signingOut ? "Signing out…" : "Sign out"}
                destructive
                disabled={signingOut}
                onPress={confirmSignOut}
                testID="settings-sign-out"
              />
            </SettingsGroup>

            <Text fontSize="$1" color="$mutedForeground" text="center">
              Meridian {appVersion}
            </Text>
          </YStack>
        </ScreenScroll>
      </SafeAreaView>

      <FormSheet
        hideFooter
        open={sheet === "profile"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Edit profile"
        description="Your display name and timezone."
      >
        <ProfileForm
          key={sheet === "profile" ? "open" : "closed"}
          initialName={displayName}
          initialTimezone={timezone}
          onSubmit={async (data) => {
            await updateProfile.mutateAsync(data);
            await profileQuery.refetch();
            setSheet(null);
            toast.success("Profile saved");
          }}
        />
      </FormSheet>

      <FormSheet
        hideFooter
        open={sheet === "targets"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Daily goals"
        description="Your daily todo and journal goals."
      >
        <TargetsSettings
          key={sheet === "targets" ? "open" : "closed"}
          initialTodoTarget={todoTarget}
          initialJournalTarget={journalTarget}
          onSubmit={async (data) => {
            await updateTargets.mutateAsync(data);
            setSheet(null);
            toast.success("Goals saved");
          }}
        />
      </FormSheet>

      <FormSheet
        hideFooter
        open={sheet === "passphrase"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Change passphrase"
        description="Your entries stay encrypted — only the passphrase that unlocks them changes. Recovery codes keep working."
      >
        <PassphraseChangeForm
          key={sheet === "passphrase" ? "open" : "closed"}
          onChangePassphrase={changeJournalPassphrase}
          onComplete={() => {
            setSheet(null);
            toast.success("Passphrase changed");
          }}
          onCancel={() => setSheet(null)}
        />
      </FormSheet>
    </YStack>
  );
}
