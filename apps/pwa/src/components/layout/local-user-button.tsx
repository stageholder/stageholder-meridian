import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Avatar, DropdownMenu, Switch, Text } from "@stageholder/ui";
import { cn } from "@/lib/utils";
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
  const initials = initialsOf(user?.name, user?.email);
  const avatar = user?.avatar ?? user?.picture;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "rounded-full transition-opacity hover:opacity-80",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
          aria-label="User menu"
        >
          <Avatar size="$2" circular>
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
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {user && (
          <>
            {/* Header padding mirrors the kit Item's $3 horizontal padding so
                the name/email block aligns flush with the menu rows below. */}
            <div className="px-3 py-1.5">
              <p className="truncate text-sm font-medium text-foreground">
                {user.name ?? user.email ?? "Signed in"}
              </p>
              {user.email && user.name && (
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              )}
            </div>
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
                {item.icon}
                <DropdownMenu.Label>{item.label}</DropdownMenu.Label>
                {/* pointerEvents="none" so the Switch is visual-only — the
                    parent Item owns the click event, avoiding a double-toggle
                    when the user happens to click the thumb directly. Thumb
                    shadow ships with the kit as of alpha.5. */}
                <Switch size="$2" checked={item.value} pointerEvents="none">
                  <Switch.Thumb />
                </Switch>
              </DropdownMenu.Item>
            );
          }
          // Router-link items use `asChild + <Link>` (kit alpha.5) so the
          // anchor semantics are preserved — middle-click "Open in new tab",
          // right-click "Copy link", and Tanstack Router's prefetch on hover
          // all work. The `<DropdownMenu.Label>` is still required inside
          // the slotted child so its flex:1 paints the full row's hover-fill.
          if (item.href) {
            return (
              <DropdownMenu.Item key={i} asChild>
                <Link
                  to={item.href}
                  style={{ textDecoration: "none" } as React.CSSProperties}
                >
                  {item.icon}
                  <DropdownMenu.Label>{item.label}</DropdownMenu.Label>
                </Link>
              </DropdownMenu.Item>
            );
          }
          return (
            <DropdownMenu.Item key={i} onPress={() => item.onSelect?.()}>
              {item.icon}
              <DropdownMenu.Label>{item.label}</DropdownMenu.Label>
            </DropdownMenu.Item>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
