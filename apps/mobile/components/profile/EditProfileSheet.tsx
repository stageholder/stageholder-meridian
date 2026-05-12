// apps/mobile/components/profile/EditProfileSheet.tsx
//
// Native profile editor for the authenticated user. Uses
// `useUpdateProfile()` from @stageholder/sdk/react-native alpha.45+,
// which PUTs /api/account/profile on Hub and refreshes the session so
// `useUser()` re-renders with new values automatically.
//
// Fields rendered match the PWA's <ProfileSettings hideFields={["phoneNumber"]}>
// (apps/pwa/components/settings/profile-form.tsx) — Meridian doesn't surface
// phone-tied features, so we hide phoneNumber too.
//
// Avatar URL is editable as a plain URL string for now (paste from
// elsewhere). Native image-pick + upload requires expo-image-picker +
// a server endpoint, deferred until both ship.

import { useUpdateProfile, useUser } from "@stageholder/sdk/react-native";
import { extractServerMessage } from "@/lib/api";
import {
  Avatar,
  Button,
  Input,
  Label,
  Sheet,
  Text,
  TextArea,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import { useEffect, useMemo, useState } from "react";

export type EditProfileSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function EditProfileSheet({ open, onClose }: EditProfileSheetProps) {
  const { user } = useUser();
  const updateProfile = useUpdateProfile();
  const toast = useToast();

  // useUser exposes a narrow Pick of MeResponse; the editable Profile
  // fields aren't on it (they live behind /api/account/profile on Hub).
  // For first-paint we seed the form with `name`/`picture` from the
  // session and let the user overwrite if they want; the server has the
  // full record and accepts a partial PUT, so unchanged fields stay
  // intact.
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");

  // Re-seed when the sheet (re)opens or the underlying user changes.
  useEffect(() => {
    if (!open) return;
    setDisplayName(user?.name ?? "");
    setAvatarUrl(user?.picture ?? "");
    // jobTitle / bio / location aren't on UseUserResult; they start
    // empty and only override when the user explicitly sets them.
    setJobTitle("");
    setBio("");
    setLocation("");
  }, [open, user?.name, user?.picture]);

  const dirty =
    displayName !== (user?.name ?? "") ||
    avatarUrl !== (user?.picture ?? "") ||
    jobTitle.length > 0 ||
    bio.length > 0 ||
    location.length > 0;

  const initials = useMemo(
    () =>
      (displayName || user?.name || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join(""),
    [displayName, user?.name],
  );

  async function handleSave() {
    if (!displayName.trim()) {
      toast.show({
        title: "Name required",
        message: "Display name can't be empty.",
        intent: "danger",
      });
      return;
    }

    // Build the partial — only send fields the user actually edited so
    // we don't blow away other fields with empty strings.
    const patch: Parameters<typeof updateProfile.mutate>[0] = {
      displayName: displayName.trim(),
    };
    if (avatarUrl !== (user?.picture ?? "")) {
      patch.avatarUrl = avatarUrl.trim() || null;
    }
    if (jobTitle.trim()) patch.jobTitle = jobTitle.trim();
    if (bio.trim()) patch.bio = bio.trim();
    if (location.trim()) patch.location = location.trim();

    // SDK's useMutation surface is narrower than React Query — `mutate`
    // takes only the input. Use `mutateAsync` + try/catch for the
    // success/error split.
    try {
      await updateProfile.mutateAsync(patch);
      toast.show({ title: "Profile updated", intent: "success" });
      onClose();
    } catch (err) {
      toast.show({
        title: "Couldn't save",
        message:
          extractServerMessage(err) ??
          (err as Error).message ??
          "Tap to retry.",
        intent: "danger",
      });
    }
  }

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) onClose();
      }}
      snapPoints={[92]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Handle />
      <Sheet.Frame>
        <Sheet.ScrollView showsVerticalScrollIndicator={false}>
          <YStack gap="$4" pb="$6">
            <Text fontSize="$6" fontWeight="700" color="$color12">
              Edit profile
            </Text>

            {/* Avatar preview — updates live as the user types a new URL */}
            <XStack items="center" gap="$3">
              <Avatar circular size="$6">
                {avatarUrl ? <Avatar.Image src={avatarUrl} /> : null}
                <Avatar.Fallback bg="$color5" items="center" justify="center">
                  <Text fontSize="$5" fontWeight="700" color="$color12">
                    {initials}
                  </Text>
                </Avatar.Fallback>
              </Avatar>
              <YStack flex={1} gap="$1">
                <Label htmlFor="profile-avatar">Avatar URL</Label>
                <Input
                  id="profile-avatar"
                  value={avatarUrl}
                  onChangeText={setAvatarUrl}
                  placeholder="https://…"
                  autoCapitalize="none"
                  autoCorrect={false}
                  size="$3"
                />
              </YStack>
            </XStack>

            <YStack gap="$2">
              <Label htmlFor="profile-name">Display name</Label>
              <Input
                id="profile-name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="What should we call you?"
                size="$4"
              />
            </YStack>

            <YStack gap="$2">
              <Label htmlFor="profile-job">Job title</Label>
              <Input
                id="profile-job"
                value={jobTitle}
                onChangeText={setJobTitle}
                placeholder="e.g. Designer at Acme"
                maxLength={100}
                size="$3"
              />
            </YStack>

            <YStack gap="$2">
              <Label htmlFor="profile-bio">Bio</Label>
              <TextArea
                id="profile-bio"
                value={bio}
                onChangeText={setBio}
                placeholder="A line or two about you"
                maxLength={500}
                minH={80 as never}
                size="$3"
              />
              <Text fontSize="$1" color="$color11" fontFamily="$mono">
                {bio.length}/500
              </Text>
            </YStack>

            <YStack gap="$2">
              <Label htmlFor="profile-location">Location</Label>
              <Input
                id="profile-location"
                value={location}
                onChangeText={setLocation}
                placeholder="City, country"
                maxLength={255}
                size="$3"
              />
            </YStack>

            <XStack gap="$2" pt="$2">
              <Button intent="ghost" onPress={onClose} flex={1}>
                Cancel
              </Button>
              <Button
                intent="primary"
                onPress={handleSave}
                flex={1}
                disabled={
                  !dirty || !displayName.trim() || updateProfile.isPending
                }
              >
                {updateProfile.isPending ? "Saving…" : "Save"}
              </Button>
            </XStack>

            <Text fontSize="$1" color="$color10" text="center">
              Email, security, and MFA still live on the Stageholder Hub.
            </Text>
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}
