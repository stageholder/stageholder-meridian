/**
 * Today-screen widget shell — the NATIVE rendering of the kit's
 * `Dashboard` / `Dashboard.Widget` (single-column stack + bordered `$card`
 * tile with an optional title row), reproduced on core-only primitives.
 *
 * Why not the kit component: since @stageholder/ui 0.4.0 `Dashboard` lives in
 * the `/data` entry together with DataGrid, Kanban, Gantt, TreeView,
 * EventCalendar, SchemaBuilder and RecordEditor. Metro evaluates a domain
 * entry as one unit the first time anything is imported from it, so pulling
 * `Dashboard` onto the Today tab (mounted at launch) made cold start pay for
 * the whole data family (~330 extra modules incl. TanStack table/virtual)
 * for what is, on a phone, a `YStack` of cards. Visuals match the kit's
 * stacked branch 1:1 (frame, header row, body padding) so nothing changes
 * for the user. Pushed screens that need real data views (habit detail →
 * `EventCalendar`) keep importing from `/data`.
 */

import { Text, View, XStack, YStack } from "@stageholder/ui";
import type { YStackProps } from "tamagui";
import type { ReactNode } from "react";

/** Vertical stack of widgets — `Dashboard`'s native branch. */
export function TodayWidgets({ children, ...rest }: YStackProps) {
  return (
    <YStack width="100%" {...rest}>
      {children}
    </YStack>
  );
}

export interface TodayWidgetProps extends Omit<YStackProps, "children"> {
  title?: ReactNode;
  /** Right-aligned slot in the title row (e.g. a "View all" link). */
  actions?: ReactNode;
  /** Hide the title row entirely (keep the tile chrome). */
  hideHeader?: boolean;
  /** Drop the hairline border (chromeless host for content with its own card). */
  bordered?: boolean;
  /** Edge-to-edge body (no body padding). */
  flush?: boolean;
  children?: ReactNode;
}

/** One stacked tile — `Dashboard.Widget`'s native branch. */
export function TodayWidget({
  title,
  actions,
  hideHeader,
  bordered = true,
  flush,
  children,
  ...rest
}: TodayWidgetProps) {
  const hasHeader = !hideHeader && (title != null || actions != null);
  return (
    <YStack
      rounded="$4"
      bg="$card"
      overflow="hidden"
      borderWidth={bordered ? 1 : 0}
      borderColor="$borderColor"
      {...rest}
    >
      {hasHeader ? (
        <XStack items="center" gap="$2.5" px="$3.5" pt="$3" pb="$1.5">
          <View flex={1} minW={0}>
            {title != null ? (
              <Text
                fontSize="$4"
                fontWeight="600"
                color="$color"
                numberOfLines={1}
              >
                {title}
              </Text>
            ) : null}
          </View>
          {actions ?? null}
        </XStack>
      ) : null}
      <YStack
        p={flush ? 0 : "$3.5"}
        grow={1}
        shrink={1}
        flexBasis="auto"
        minW={0}
        minH={0}
        overflow="hidden"
      >
        {children}
      </YStack>
    </YStack>
  );
}
