import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Avatar, DropdownMenu, Switch, Text, View } from "@stageholder/ui";
import { useUser } from "@/hooks/use-user";

/**
 * SPA-local replacement for the SDK's `<UserButton>`. The SDK component
 * lives only in `@stageholder/sdk/react` and internally calls hooks that
 * read from the BFF-flavor StageholderContext — unreachable under our
 * SPA provider (dual-package hazard). Same shape, no SDK dependency.
 *
 * Menu items are a discriminated union:
 *   - `kind: "action"` (default) — clickable row. `href` triggers router
 *     navigation; `onSelect` runs an imperative callback (e.g. sign out).
 *   - `kind: "switch"` — toggle row. Renders the label + a kit `Switch`.
 *     The entire row is the press target — clicks anywhere flip `value`
 *     via `onChange`. The Switch itself is pointer-events-none so the row
 *     owns the single click event (no double-toggle).
 */
export type UserMenuItem =
  | {
      kind?: "action";
      label: string;
      href?: string;
      onSelect?: () => void;
      icon?: ReactNode;
    }
  | {
      kind: "switch";
      label: string;
      value: boolean;
      onChange: (value: boolean) => void;
      icon?: ReactNode;
    };

interface LocalUserButtonProps {
  menuItems: UserMenuItem[];
  /** Kept for API parity with SDK's `<UserButton hideSignOut>`. We never
   *  render a built-in sign-out — callers always pass it as a menu item. */
  hideSignOut?: boolean;
}

function initialsOf(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  }
  if (email) return email[0]?.toUpperCase() ?? "?";
  return "?";
}

export function LocalUserButton({ menuItems }: LocalUserButtonProps) {
  const { user } = useUser();
  const navigate = useNavigate();
  const initials = initialsOf(user?.name, user?.email);
  const avatar = user?.avatar ?? user?.picture;

  return (
    // `placement="bottom-end"`: the avatar sits at the header's top-right, so
    // the kit's default `bottom-start` (which the kit deliberately renders with
    // no auto-flip) opens the menu off the right edge of the screen. End-align
    // it so it drops down-and-left into the viewport, like the journey popover.
    <DropdownMenu placement="bottom-end">
      {/* Kit-canonical user menu: the Avatar IS the trigger (asChild) — exactly
          the kit's own header UserMenu example. It's purely presentational with
          no press-scale, so it stays a stable floating-ui anchor. A Button
          scales on press, which shifts the anchor mid-open → react-native-web's
          "Cannot record touch end without a touch start"; a bare View isn't a
          press responder at all. RippleButton is the other sanctioned trigger. */}
      <DropdownMenu.Trigger asChild>
        <Avatar
          size="sm"
          circular
          cursor="pointer"
          hoverStyle={{ opacity: 0.8 }}
          {...({ "aria-label": "User menu" } as object)}
        >
          {avatar ? (
            <Avatar.Image
              src={avatar}
              accessibilityLabel={user?.name ?? user?.email ?? "User"}
            />
          ) : null}
          <Avatar.Fallback
            bg="$muted"
            items="center"
            justify="center"
            borderWidth={1}
            borderColor="$borderColor"
          >
            <Text fontSize="$2" fontWeight="500" color="$color">
              {initials}
            </Text>
          </Avatar.Fallback>
        </Avatar>
      </DropdownMenu.Trigger>
      {/* `onOpenAutoFocus` preventDefault: the kit menu (a Tamagui Popover)
          focuses its content on open, which lands a focus ring on the first
          menuitem — visible on every mouse-open (the row the ring sits on just
          tracks whichever item renders first). Preventing the mount auto-focus
          drops the ring while the focus scope (Esc, trap, return-focus) stays
          intact for keyboard users. */}
      <DropdownMenu.Content
        {...({ onOpenAutoFocus: (e: Event) => e.preventDefault() } as object)}
      >
        {user && (
          <>
            {/* Header padding mirrors the kit Item's $3 horizontal padding so
                the name/email block aligns flush with the menu rows below. */}
            <View px="$3" py="$1.5">
              <Text
                fontSize="$3"
                fontWeight="500"
                color="$color"
                numberOfLines={1}
              >
                {user.name ?? user.email ?? "Signed in"}
              </Text>
              {user.email && user.name && (
                <Text fontSize="$1" color="$mutedForeground" numberOfLines={1}>
                  {user.email}
                </Text>
              )}
            </View>
            <DropdownMenu.Separator />
          </>
        )}
        {menuItems.map((item, i) => {
          if (item.kind === "switch") {
            return (
              <DropdownMenu.Item
                key={i}
                onPress={() => item.onChange(!item.value)}
              >
                <Text color="$color" lineHeight={0}>
                  {item.icon}
                </Text>
                <DropdownMenu.Label>{item.label}</DropdownMenu.Label>
                {/* Visual-only switch — the row's onPress owns the toggle.
                    `pointerEvents="none"` lets clicks fall through to the row
                    (no double-toggle) and tabIndex -1 keeps it out of the tab
                    order; the row is the real control. The menu no longer
                    auto-focuses on open, so no `disabled` hack is needed. */}
                <Switch
                  size="$2"
                  checked={item.value}
                  pointerEvents="none"
                  {...({ tabIndex: -1 } as object)}
                >
                  <Switch.Thumb />
                </Switch>
              </DropdownMenu.Item>
            );
          }
          // Link items follow the kit docs' primary `render="a"` pattern: the
          // Item renders AS the anchor, so it keeps all its chrome (flex row,
          // padding, hover, focus) and is a real, right-clickable link
          // (middle-click → new tab). onPress intercepts the plain left-click
          // for client-side navigation. (The docs' asChild+<Link> prefetch
          // variant slots the row styles onto the Link's <a>, which here lost
          // the flex layout + hover — render="a" keeps them reliably.)
          if (item.href) {
            const href = item.href;
            return (
              <DropdownMenu.Item
                key={i}
                render="a"
                onPress={(e: { preventDefault?: () => void }) => {
                  e?.preventDefault?.();
                  void navigate({ to: href });
                }}
                {...({ href } as object)}
              >
                <Text color="$color" lineHeight={0}>
                  {item.icon}
                </Text>
                <DropdownMenu.Label>{item.label}</DropdownMenu.Label>
              </DropdownMenu.Item>
            );
          }
          return (
            <DropdownMenu.Item key={i} onPress={() => item.onSelect?.()}>
              <Text color="$color" lineHeight={0}>
                {item.icon}
              </Text>
              <DropdownMenu.Label>{item.label}</DropdownMenu.Label>
            </DropdownMenu.Item>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
