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

import { useState } from "react";
import {
  Avatar,
  Banner,
  Button,
  Card,
  FormSheet,
  Paragraph,
  ScrollView,
  SizableText,
  Separator,
  Spinner,
  Tabs,
  Text,
  XStack,
  YStack,
} from "@stageholder/ui";
import { ProfileForm, TargetsSettings } from "@repo/features/settings";
import { openURL } from "@repo/core/platform/linking";
import { useUpdateProfile, useUser } from "@stageholder/sdk/react-native";
import {
  ArrowRight,
  CreditCard,
  ExternalLink,
  Pencil,
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

/** Query-failure banner — a silently-empty form is the WORST settings UX
 *  (looks broken with no way forward), so failures show the real message
 *  plus a retry. */
function SectionError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Banner intent="danger">
      <Banner.Body>
        <Banner.Title>{title}</Banner.Title>
        <Banner.Description>
          {(error as Error)?.message ?? "Network error."}
        </Banner.Description>
        <Banner.Action self="flex-end" mt="$2">
          <Button intent="secondary" size="sm" onPress={onRetry}>
            Try again
          </Button>
        </Banner.Action>
      </Banner.Body>
    </Banner>
  );
}

/** One read-only settings row — small muted label over the current value
 *  (the iOS Settings idiom: view first, edit behind an explicit action). */
function InfoRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <XStack items="center" justify="space-between" gap="$3" px="$4" py="$3">
      <Text fontSize="$3" color="$color">
        {label}
      </Text>
      <Text
        flex={1}
        minW={0}
        text="right"
        numberOfLines={1}
        fontSize="$3"
        color={muted ? "$mutedForeground" : "$color"}
      >
        {value}
      </Text>
    </XStack>
  );
}

/** Profile, VIEW-FIRST: a read-only card of current values + an Edit action
 *  that opens the shared ProfileForm in a FormSheet. Reads from Hub (404 =
 *  fresh account with no profile row — seed from the session identity; the
 *  first save creates it via the same PUT). */
function ProfileSection() {
  const profileQuery = useHubProfile();
  const update = useUpdateProfile();
  const { user } = useUser();
  const [editOpen, setEditOpen] = useState(false);

  const status = (profileQuery.error as { response?: { status?: number } })
    ?.response?.status;
  const isMissingProfile = status === 404;

  if (profileQuery.isError && !isMissingProfile) {
    return (
      <SectionError
        title="Couldn't load your profile"
        error={profileQuery.error}
        onRetry={() => void profileQuery.refetch()}
      />
    );
  }

  const seedName = profileQuery.data?.displayName ?? user?.name ?? "";
  const seedTimezone = profileQuery.data?.timezone ?? "";

  return (
    <>
      <Card>
        <Card.Body p="$0" gap="$0">
          {profileQuery.isLoading ? (
            <XStack px="$4" py="$4" items="center" justify="center">
              <Spinner />
            </XStack>
          ) : (
            <>
              {/* Identity header — photo from the Hub profile (falls back to
                  the session's OIDC picture), name, email. Changing the
                  photo is a Hub web surface for now (avatar upload needs a
                  native image-picker flow — not built yet). */}
              <XStack items="center" gap="$3" px="$4" py="$3.5">
                <Avatar
                  src={
                    profileQuery.data?.avatarUrl ?? user?.picture ?? undefined
                  }
                  name={seedName || user?.email || "User"}
                  size="lg"
                />
                <YStack flex={1} minW={0}>
                  <Text
                    fontSize="$4"
                    fontWeight="600"
                    color="$color"
                    numberOfLines={1}
                  >
                    {seedName || "—"}
                  </Text>
                  {profileQuery.data?.email || user?.email ? (
                    <Text
                      fontSize="$2"
                      color="$mutedForeground"
                      numberOfLines={1}
                    >
                      {profileQuery.data?.email ?? user?.email}
                    </Text>
                  ) : null}
                </YStack>
              </XStack>
              <Separator />
              <InfoRow label="Display name" value={seedName || "—"} />
              <Separator />
              <InfoRow
                label="Timezone"
                value={seedTimezone || "Not set"}
                muted={!seedTimezone}
              />
              <Separator />
              <XStack px="$4" py="$3">
                <Button
                  intent="outline"
                  size="sm"
                  flex={1}
                  icon={<Pencil size={14} />}
                  onPress={() => setEditOpen(true)}
                >
                  Edit profile
                </Button>
              </XStack>
            </>
          )}
        </Card.Body>
      </Card>

      {/* Edit — the shared form (name + timezone + its own Save) in a
          FormSheet, re-seeded per open. Sheet closes on a successful save. */}
      <FormSheet
        hideFooter
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Profile"
        description="Your display name and timezone."
      >
        <ProfileForm
          key={editOpen ? "open" : "closed"}
          initialName={seedName}
          initialTimezone={seedTimezone}
          onSubmit={async (data) => {
            await update.mutateAsync(data);
            await profileQuery.refetch();
            setEditOpen(false);
          }}
        />
      </FormSheet>
    </>
  );
}

/** Targets, VIEW-FIRST: current daily targets as read-only rows + Edit →
 *  the shared TargetsSettings form in a FormSheet. */
function TargetsSection() {
  const lightQuery = useUserLight();
  const updateTargets = useUpdateTargets();
  const [editOpen, setEditOpen] = useState(false);

  if (lightQuery.isError) {
    return (
      <SectionError
        title="Couldn't load your targets"
        error={lightQuery.error}
        onRetry={() => void lightQuery.refetch()}
      />
    );
  }

  const todoTarget = lightQuery.data?.todoTargetDaily;
  const journalTarget = lightQuery.data?.journalTargetDailyWords;

  return (
    <>
      <Card>
        <Card.Body p="$0" gap="$0">
          {lightQuery.isLoading ? (
            <XStack px="$4" py="$4" items="center" justify="center">
              <Spinner />
            </XStack>
          ) : (
            <>
              <InfoRow
                label="Daily todos"
                value={todoTarget != null ? `${todoTarget} / day` : "—"}
              />
              <Separator />
              <InfoRow
                label="Journal words"
                value={
                  journalTarget != null ? `${journalTarget} words / day` : "—"
                }
              />
              <Separator />
              <XStack px="$4" py="$3">
                <Button
                  intent="outline"
                  size="sm"
                  flex={1}
                  icon={<Pencil size={14} />}
                  onPress={() => setEditOpen(true)}
                >
                  Edit targets
                </Button>
              </XStack>
            </>
          )}
        </Card.Body>
      </Card>

      <FormSheet
        hideFooter
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Targets"
        description="Your daily todo and journal goals."
      >
        <TargetsSettings
          key={editOpen ? "open" : "closed"}
          initialTodoTarget={todoTarget}
          initialJournalTarget={journalTarget}
          onSubmit={async (data) => {
            await updateTargets.mutateAsync(data);
            setEditOpen(false);
          }}
        />
      </FormSheet>
    </>
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

                      {/* About — inside Account (not a screen footer) so it
                          doesn't trail every tab's content. */}
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
                            Journal security — passphrase change and recovery —
                            lives on the web app for now.
                          </Paragraph>
                        </Card.Body>
                      </Card>
                    </YStack>
                  </Tabs.Content>
                </YStack>
              </YStack>
            </Tabs>
          </YStack>
        </ScrollView>
      </SafeAreaView>
    </YStack>
  );
}
