import { useState, type ReactNode } from "react";
import { YStack } from "@stageholder/ui";
import { SectionHeader } from "../todos/section-header";

/**
 * Collapsible "Completed" / "Done" group — the shared `SectionHeader` in its
 * collapsible form (chevron + uppercase label · count) that expands to reveal
 * its children. Used by the PWA and native agendas and by the Todos tab's
 * Completed section, so finished items look and behave the same everywhere.
 * Renders nothing when `count` is 0.
 *
 * Starts collapsed by default (`defaultOpen` to override) — finished items are
 * tucked away so a list leads with what's still pending.
 */
export function CollapsibleGroup({
  label,
  count,
  defaultOpen = false,
  children,
}: {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <YStack>
      <SectionHeader
        label={label}
        count={count}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      {open ? <YStack gap="$2">{children}</YStack> : null}
    </YStack>
  );
}
