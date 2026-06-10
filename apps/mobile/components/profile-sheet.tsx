// apps/mobile/components/profile-sheet.tsx
//
// The bottom-nav Profile menu — native mirror of the PWA's mobile Profile
// sheet (apps/pwa/src/components/layout/mobile-bottom-nav.tsx, where the kit
// DropdownMenu auto-adapts to a bottom Sheet at max-md). Same rows, same
// order as the PWA's useUserMenuItems:
//
//   [user header: avatar · name · email]
//   ─────────────────────────────────────
//   Account settings   → /settings route
//   Plans & billing    → /billing route (native billing screen)
//   Dark mode          → switch row (stays open so the change is visible)
//   Sign out           → SDK signOut (root layout redirects to /sign-in)
//
// On NATIVE this is a DRIVEN kit Sheet, not the PWA's DropdownMenu+Adapt —
// per the alpha.31 sheet rules (Adapt parks the frame offscreen → overlay-
// only). `fit` snap mode is fine: the rows are direct content, no ScrollView.

import { useState } from "react";
import { useStageholder, useUser } from "@stageholder/sdk/react-native";
import {
  Avatar,
  Separator,
  Sheet,
  Spinner,
  Switch,
  Text,
  XStack,
  YStack,
  useToast,
} from "@stageholder/ui";
import { CreditCard, LogOut, Moon, UserCog } from "@tamagui/lucide-icons-2";
import { useRouter } from "expo-router";

import { useAppTheme } from "@/lib/platform/theme";

interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** One tappable menu row — icon · label · optional trailing slot. The row is
 *  the single press target (mirrors the PWA's UserMenuContent rows, where the
 *  trailing Switch is pointer-events-none and the row owns the toggle). */
function MenuRow({
  icon,
  label,
  trailing,
  destructive = false,
  disabled = false,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      items="center"
      gap="$3"
      px="$3"
      py="$3"
      rounded="$3"
      opacity={disabled ? 0.5 : 1}
      pressStyle={{ bg: "$muted" }}
      onPress={disabled ? undefined : onPress}
    >
      {icon}
      <Text
        flex={1}
        fontSize="$4"
        color={destructive ? "$destructive" : "$color"}
      >
        {label}
      </Text>
      {trailing}
    </XStack>
  );
}

export function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useUser();
  const { signOut } = useStageholder();
  const { resolvedTheme, setTheme } = useAppTheme();
  const isDark = resolvedTheme === "dark";

  const [signingOut, setSigningOut] = useState(false);

  function close() {
    onOpenChange(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      // Root layout's onSignedOut redirects to /sign-in once the session is
      // cleared — no manual navigation. The sheet unmounts with the tree.
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

  return (
    <Sheet
      modal
      open={open}
      onOpenChange={onOpenChange}
      dismissOnSnapToBottom
      snapPointsMode="fit"
    >
      <Sheet.Overlay />
      <Sheet.Frame pt="$4" pb="$6" px="$3" gap="$1">
        {/* ---- User header — avatar · name · email (PWA parity) ---- */}
        {user ? (
          <>
            <XStack items="center" gap="$3" px="$3" pb="$2">
              <Avatar
                src={user.picture ?? undefined}
                name={user.name ?? user.email ?? "User"}
                size="md"
              />
              <YStack flex={1} minW={0}>
                <Text
                  fontSize="$4"
                  fontWeight="600"
                  color="$color"
                  numberOfLines={1}
                >
                  {user.name ?? user.email ?? "Signed in"}
                </Text>
                {user.email && user.name ? (
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
            <Separator mb="$1" />
          </>
        ) : null}

        {/* ---- Menu rows — same items/order as the PWA's useUserMenuItems
             (minus the desktop-only update check) ---- */}
        <MenuRow
          icon={<UserCog size={18} color="$color" />}
          label="Account settings"
          onPress={() => {
            close();
            router.navigate("/settings");
          }}
        />
        <MenuRow
          icon={<CreditCard size={18} color="$color" />}
          label="Plans & billing"
          onPress={() => {
            close();
            router.navigate("/billing");
          }}
        />
        <MenuRow
          icon={<Moon size={18} color="$color" />}
          label="Dark mode"
          // Stays open on toggle (PWA behavior) so the theme change is
          // visible under the sheet.
          onPress={() => setTheme(isDark ? "light" : "dark")}
          trailing={
            <Switch size="$2" checked={isDark} pointerEvents="none">
              <Switch.Thumb />
            </Switch>
          }
        />
        <Separator my="$1" />
        <MenuRow
          icon={
            signingOut ? (
              <Spinner size="small" />
            ) : (
              <LogOut size={18} color="$destructive" />
            )
          }
          label={signingOut ? "Signing out…" : "Sign out"}
          destructive
          disabled={signingOut}
          onPress={() => void handleSignOut()}
        />
      </Sheet.Frame>
    </Sheet>
  );
}
