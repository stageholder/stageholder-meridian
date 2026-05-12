// apps/mobile/app/(authed)/profile.tsx
//
// Profile screen — identity, light tier display, targets editor, sign-out.
// Adapted from PWA's Settings page (apps/pwa/app/app/settings/page.tsx)
// which uses a Profile/Targets/Account tab layout. On mobile we stack
// sections vertically instead of using tabs — easier to scan on a phone.
//
// Targets editor (todoTargetDaily, journalTargetDailyWords) hits
// PATCH /light/targets. Light tier card is read-only here; the
// LevelUpCelebration overlay fires from Today screen when totalLight
// crosses a tier boundary (P3.1).

import { useStageholder, useUser } from "@stageholder/sdk/react-native";
import {
  Avatar,
  Banner,
  Button,
  Card,
  H3,
  List,
  NumberInput,
  Paragraph,
  Progress,
  Text,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import { LIGHT_TIERS, getTierProgress } from "@repo/core/types";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import {
  extractServerMessage,
  useUpdateTargets,
  useUserLight,
} from "@/lib/api";

export default function ProfileScreen() {
  const { signOut } = useStageholder();
  const { user } = useUser();
  const lightQuery = useUserLight();
  const updateTargets = useUpdateTargets();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);

  // Targets — local drafts re-seeded when the server value changes.
  const serverTodo = lightQuery.data?.todoTargetDaily ?? 5;
  const serverWords = lightQuery.data?.journalTargetDailyWords ?? 200;
  const [todoTarget, setTodoTarget] = useState(serverTodo);
  const [wordTarget, setWordTarget] = useState(serverWords);
  useEffect(() => setTodoTarget(serverTodo), [serverTodo]);
  useEffect(() => setWordTarget(serverWords), [serverWords]);

  const dirty = todoTarget !== serverTodo || wordTarget !== serverWords;

  function handleSaveTargets() {
    updateTargets.mutate(
      {
        todoTargetDaily: todoTarget,
        journalTargetDailyWords: wordTarget,
      },
      {
        onSuccess: () =>
          toast.show({ title: "Targets updated", intent: "success" }),
        onError: (err) =>
          toast.show({
            title: "Couldn't save targets",
            message:
              extractServerMessage(err) ??
              (err as Error).message ??
              "Tap to retry.",
            intent: "danger",
          }),
      },
    );
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join("")
    : "?";

  const light = lightQuery.data;
  const tierIndex = (light?.currentTier ?? 1) - 1;
  const tier = LIGHT_TIERS[tierIndex] ?? LIGHT_TIERS[0]!;
  const nextTier = LIGHT_TIERS[tierIndex + 1];
  const tierPct = light
    ? getTierProgress(light.totalLight, light.currentTier)
    : 0;

  return (
    <YStack flex={1} bg="$background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
        >
          <YStack gap="$5" pt="$4">
            <YStack gap="$1">
              <Paragraph
                fontFamily="$mono"
                fontSize={11}
                letterSpacing={2}
                textTransform="uppercase"
                color="$color11"
              >
                Profile · targets · account
              </Paragraph>
              <H3 color="$color12">You</H3>
            </YStack>

            {/* ---- Identity ---- */}
            <Card>
              <Card.Body gap="$3">
                <XStack items="center" gap="$3">
                  <Avatar circular size="$5">
                    {user?.picture ? <Avatar.Image src={user.picture} /> : null}
                    <Avatar.Fallback
                      bg="$color5"
                      items="center"
                      justify="center"
                    >
                      <Text fontSize="$5" fontWeight="700" color="$color12">
                        {initials}
                      </Text>
                    </Avatar.Fallback>
                  </Avatar>
                  <YStack flex={1} gap={2}>
                    <Text fontSize="$4" fontWeight="600" color="$color12">
                      {user?.name ?? "Unknown"}
                    </Text>
                    <Paragraph fontSize="$2" color="$color11" numberOfLines={1}>
                      {user?.email ?? "—"}
                    </Paragraph>
                  </YStack>
                </XStack>
                {/* In-app edit via useUpdateProfile (SDK alpha.45+). The
                    session is refreshed on success so this card re-renders
                    automatically with the new name/picture. */}
                <Button
                  intent="secondary"
                  size="$2"
                  onPress={() => setEditOpen(true)}
                >
                  Edit profile
                </Button>
              </Card.Body>
            </Card>

            {/* ---- Light tier ---- */}
            {light ? (
              <Card>
                <Card.Header>
                  <XStack items="center" justify="space-between">
                    <YStack gap="$1">
                      <Paragraph
                        fontFamily="$mono"
                        fontSize={10}
                        letterSpacing={1.6}
                        textTransform="uppercase"
                        color="$color11"
                        fontWeight="600"
                      >
                        Tier {light.currentTier}
                      </Paragraph>
                      <Text fontSize="$4" color="$color12" fontWeight="700">
                        {tier.title}
                      </Text>
                    </YStack>
                    <YStack items="flex-end" gap={2}>
                      <Text
                        fontFamily="$mono"
                        fontSize="$3"
                        color="$color12"
                        fontWeight="700"
                      >
                        {light.totalLight.toLocaleString()}
                      </Text>
                      <Text fontSize={10} color="$color11" fontFamily="$mono">
                        LIGHT
                      </Text>
                    </YStack>
                  </XStack>
                </Card.Header>
                <Card.Body gap="$3">
                  <Paragraph fontSize="$2" color="$color11" lineHeight="$2">
                    {tier.shortDescription}
                  </Paragraph>
                  {nextTier ? (
                    <YStack gap="$1">
                      <XStack justify="space-between">
                        <Text fontSize="$1" color="$color11">
                          Next · {nextTier.title}
                        </Text>
                        <Text fontSize="$1" color="$color11" fontFamily="$mono">
                          {light.totalLight} / {nextTier.lightRequired}
                        </Text>
                      </XStack>
                      <Progress value={tierPct}>
                        <Progress.Indicator />
                      </Progress>
                    </YStack>
                  ) : (
                    <Paragraph
                      fontSize="$1"
                      color="$color11"
                      fontStyle="italic"
                    >
                      You've reached the highest tier.
                    </Paragraph>
                  )}
                  <XStack gap="$4">
                    <YStack items="center" gap={2}>
                      <Text
                        fontFamily="$mono"
                        fontSize="$4"
                        color="$color12"
                        fontWeight="700"
                      >
                        {light.perfectDayStreak}
                      </Text>
                      <Text fontSize={9} color="$color11" fontFamily="$mono">
                        PERFECT DAYS
                      </Text>
                    </YStack>
                    <YStack items="center" gap={2}>
                      <Text
                        fontFamily="$mono"
                        fontSize="$4"
                        color="$color12"
                        fontWeight="700"
                      >
                        {light.longestPerfectStreak}
                      </Text>
                      <Text fontSize={9} color="$color11" fontFamily="$mono">
                        LONGEST
                      </Text>
                    </YStack>
                    <YStack items="center" gap={2}>
                      <Text
                        fontFamily="$mono"
                        fontSize="$4"
                        color="$color12"
                        fontWeight="700"
                      >
                        {light.perfectDaysTotal}
                      </Text>
                      <Text fontSize={9} color="$color11" fontFamily="$mono">
                        TOTAL
                      </Text>
                    </YStack>
                  </XStack>
                </Card.Body>
              </Card>
            ) : lightQuery.error ? (
              <Banner intent="warning">
                <Banner.Title>Couldn't load tier</Banner.Title>
                <Banner.Description>
                  {(lightQuery.error as Error).message ?? "Network error."}
                </Banner.Description>
              </Banner>
            ) : null}

            {/* ---- Targets ---- */}
            <Card>
              <Card.Header>
                <YStack gap="$1">
                  <Paragraph
                    fontFamily="$mono"
                    fontSize={10}
                    letterSpacing={1.6}
                    textTransform="uppercase"
                    color="$color11"
                    fontWeight="600"
                  >
                    Daily targets
                  </Paragraph>
                  <Paragraph fontSize="$2" color="$color11">
                    Used to fill the activity rings on Today.
                  </Paragraph>
                </YStack>
              </Card.Header>
              <Card.Body gap="$3">
                <XStack items="center" justify="space-between" gap="$3">
                  <YStack flex={1}>
                    <Text fontSize="$3" color="$color12" fontWeight="500">
                      Todos per day
                    </Text>
                    <Paragraph fontSize="$1" color="$color11">
                      1–50
                    </Paragraph>
                  </YStack>
                  <NumberInput
                    value={todoTarget}
                    min={1}
                    max={50}
                    onChange={setTodoTarget}
                  />
                </XStack>
                <XStack items="center" justify="space-between" gap="$3">
                  <YStack flex={1}>
                    <Text fontSize="$3" color="$color12" fontWeight="500">
                      Journal words per day
                    </Text>
                    <Paragraph fontSize="$1" color="$color11">
                      10–5,000
                    </Paragraph>
                  </YStack>
                  <NumberInput
                    value={wordTarget}
                    min={10}
                    max={5000}
                    step={10}
                    onChange={setWordTarget}
                  />
                </XStack>
                <Button
                  intent="primary"
                  size="$3"
                  onPress={handleSaveTargets}
                  disabled={!dirty || updateTargets.isPending}
                >
                  {updateTargets.isPending
                    ? "Saving…"
                    : dirty
                      ? "Save targets"
                      : "Saved"}
                </Button>
              </Card.Body>
            </Card>

            {/* ---- Account — single-user personal-org model, so we only
                 surface the user-facing identity (sub) for support. ---- */}
            <Card>
              <Card.Header>
                <Text
                  fontFamily="$mono"
                  fontSize={10}
                  letterSpacing={1.6}
                  textTransform="uppercase"
                  color="$color11"
                  fontWeight="600"
                >
                  Account
                </Text>
              </Card.Header>
              <Card.Body p={0 as never}>
                <List>
                  <List.Item>
                    <List.Group>
                      <List.Title>User ID</List.Title>
                      <List.Description>{user?.sub ?? "—"}</List.Description>
                    </List.Group>
                  </List.Item>
                </List>
              </Card.Body>
            </Card>

            <Button intent="destructive" onPress={signOut}>
              Sign out
            </Button>

            <Paragraph fontSize="$1" color="$color10" text="center">
              Email, security, MFA, and billing live on the Stageholder Hub.
            </Paragraph>
          </YStack>
        </ScrollView>
      </SafeAreaView>

      <EditProfileSheet open={editOpen} onClose={() => setEditOpen(false)} />
    </YStack>
  );
}
