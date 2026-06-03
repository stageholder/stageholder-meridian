import { useMemo } from "react";
import {
  UserCog,
  CreditCard,
  Moon,
  RefreshCw,
  LogOut,
} from "@tamagui/lucide-icons-2";
import { useStageholder } from "@stageholder/sdk/spa";
import { isDesktop } from "@repo/core/platform";
import { useAppTheme } from "@/lib/platform/theme";
import { useUpdateStore } from "@/lib/update-store";
import type { UserMenuItem } from "@/components/layout/local-user-button";

/**
 * The account/user menu — the single source of truth shared by the desktop
 * header avatar (`LocalUserButton`) and the mobile bottom-nav Profile sheet, so
 * the two can never drift (same pattern as `nav-items.ts`).
 *
 * Account/billing are `href` rows; dark mode is a `switch`; sign-out and the
 * desktop-only update check are `onSelect` actions. Theme/sign-out/update
 * plumbing lives here rather than in each consumer.
 */
export function useUserMenuItems(): UserMenuItem[] {
  const { signOut } = useStageholder();
  const { resolvedTheme, setTheme } = useAppTheme();
  const isDark = resolvedTheme === "dark";

  return useMemo<UserMenuItem[]>(
    () => [
      {
        // Profile editing lives in-app via the SDK's <ProfileSettings>; Hub
        // security ops are reachable from /settings → Account.
        label: "Account settings",
        href: "/settings",
        icon: <UserCog size={16} />,
      },
      {
        label: "Plans & billing",
        href: "/settings/billing",
        icon: <CreditCard size={16} />,
      },
      {
        kind: "switch",
        label: "Dark mode",
        value: isDark,
        onChange: (next) => setTheme(next ? "dark" : "light"),
        icon: <Moon size={16} />,
      },
      // Desktop-only: the Tauri updater plugin isn't available on web.
      ...(isDesktop()
        ? [
            {
              label: "Check for updates",
              onSelect: () =>
                useUpdateStore
                  .getState()
                  .requestCheck({ showWhenUpToDate: true }),
              icon: <RefreshCw size={16} />,
            } as UserMenuItem,
          ]
        : []),
      {
        // SDK signOut runs the SPA logout flow (revokes tokens, clears storage,
        // hits the Hub end-session endpoint, lands on /goodbye — which owns the
        // cross-tab broadcast, so we don't broadcast here and race it).
        label: "Sign out",
        onSelect: () => void signOut(),
        icon: <LogOut size={16} />,
      },
    ],
    [isDark, setTheme, signOut],
  );
}

/** Two-letter initials from a name (or first email letter) for avatar fallbacks. */
export function getUserInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  }
  if (email) return email[0]?.toUpperCase() ?? "?";
  return "?";
}
