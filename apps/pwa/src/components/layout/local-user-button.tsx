import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";

/**
 * SPA-local replacement for the SDK's `<UserButton>`. The SDK component
 * lives only in `@stageholder/sdk/react` and internally calls hooks that
 * read from the BFF-flavor StageholderContext — unreachable under our
 * SPA provider (dual-package hazard). Same shape, no SDK dependency.
 *
 * Menu items support both `href` (TanStack `<Link>`) and `onSelect`
 * (imperative callback like sign-out). Icon is rendered inline before
 * the label so menu rows align visually.
 */
export interface UserMenuItem {
  label: string;
  href?: string;
  onSelect?: () => void;
  icon?: ReactNode;
}

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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex size-8 items-center justify-center overflow-hidden rounded-full",
            "border border-border bg-muted text-xs font-medium text-foreground",
            "transition-opacity hover:opacity-80 focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
          aria-label="User menu"
        >
          {avatar ? (
            <img
              src={avatar}
              alt={user?.name ?? user?.email ?? "User"}
              className="size-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 min-w-[200px] overflow-hidden rounded-lg border border-border",
            "bg-popover p-1 text-popover-foreground shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          {user && (
            <>
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium text-foreground">
                  {user.name ?? user.email ?? "Signed in"}
                </p>
                {user.email && user.name && (
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                )}
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
            </>
          )}
          {menuItems.map((item, i) => {
            const content = (
              <span className="flex items-center gap-2">
                {item.icon}
                <span>{item.label}</span>
              </span>
            );
            const className = cn(
              "block cursor-pointer rounded-md px-2 py-1.5 text-sm text-foreground",
              "outline-none transition-colors",
              "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
            );
            if (item.href) {
              return (
                <DropdownMenu.Item key={i} asChild className={className}>
                  <Link to={item.href}>{content}</Link>
                </DropdownMenu.Item>
              );
            }
            return (
              <DropdownMenu.Item
                key={i}
                onSelect={() => item.onSelect?.()}
                className={className}
              >
                {content}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
