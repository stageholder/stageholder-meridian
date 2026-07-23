// GitHub-contribution-style heatmap of journal words written, day by day —
// but split into per-month "tetris" blocks with spacing between them.
//
// Built on the kit's cross-platform `Heatmap` (a pure Tamagui View grid — no
// SVG — so it renders on web AND native). Two customisations:
//
//  1. TINT. The kit hardcodes its intensity scale to primary-blue with no
//     base-colour prop, so we recolour every cell with the JOURNAL identity
//     colour (yellow) via the sanctioned `renderCell` hook. A raw rgb triple
//     (not `var(--ring-journal)`) because the tint needs per-level ALPHA
//     compositing and RN can't parse oklch/CSS-vars (same as light-earned).
//
//  2. PER-MONTH BLOCKS. We render one `<Heatmap>` per month, each clipped to
//     that month's date range (`startDate`/`endDate`) and laid out in a row
//     with a gap between them — the "tetris with spacing" look. Crucially each
//     block is fed the FULL dataset (not just its month): the kit derives its
//     intensity `maxValue` from the data passed, so passing everything keeps
//     ONE shared colour scale across all months while the range clip means
//     each block still only paints its own days.

import {
  Heatmap,
  ScrollView,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
} from "@stageholder/ui";
import type { HeatmapCellRenderArgs } from "@stageholder/ui";
import { useRef, useState } from "react";
import { isWeb } from "tamagui";

/** One day's total word count. `date` is a local `yyyy-MM-dd` key. */
export interface WritingHeatmapDay {
  date: string;
  words: number;
}

export interface WritingHeatmapChartProps {
  data: WritingHeatmapDay[];
  isLoading?: boolean;
  /**
   * Base cell colour — a resolved hex (`#RRGGBB`). Defaults to the journal
   * identity yellow. NOT a kit `$token` or CSS `var(...)`: the tint composites
   * per-level alpha, which needs a concrete rgb (and RN can't read oklch vars).
   */
  color?: string;
  /** Cell side length in px. Default: 18 (chunky, to fill the card vertically). */
  cellSize?: number;
  /** Rolling window length in months. Default: 6. */
  months?: number;
}

/** Journal identity colour (`--ring-journal` resolved) as an `r, g, b` triple. */
const JOURNAL_RGB = "250, 204, 21"; // #facc15

const LEVELS = 5;
const GAP = 3;

function hexToRgbTriple(hex?: string): string {
  if (!hex) return JOURNAL_RGB;
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return JOURNAL_RGB;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return JOURNAL_RGB;
  return `${r}, ${g}, ${b}`;
}

/**
 * Cell fill for a given intensity bucket. `intensity` is 0 for empty days and
 * 1..LEVELS-1 for days with words (the kit bumps filled days by one bucket).
 * Empty days get a faint track; filled days ramp from ~0.4 → 1.0 alpha.
 */
function fillFor(intensity: number, rgb: string): string {
  if (intensity <= 0) return `rgba(${rgb}, 0.1)`;
  const t = intensity / (LEVELS - 1);
  const alpha = 0.2 + t * 0.8;
  return `rgba(${rgb}, ${alpha.toFixed(2)})`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** One rendered block: a calendar month clipped to the overall window. */
interface MonthBlock {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

/**
 * Split [windowStart, today] into per-calendar-month blocks. The first block
 * starts mid-month (at windowStart); the last ends at today.
 */
function buildMonthBlocks(windowStart: Date, end: Date): MonthBlock[] {
  const blocks: MonthBlock[] = [];
  let cursor = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
  while (cursor <= end) {
    const monthFirst = cursor;
    const monthLast = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const start = monthFirst < windowStart ? windowStart : monthFirst;
    const blockEnd = monthLast > end ? end : monthLast;
    blocks.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: MONTH_FMT.format(cursor),
      start: startOfDay(start),
      end: startOfDay(blockEnd),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return blocks;
}

const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: "short" });
const DAY_FMT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

/**
 * Cursor viewport coords from a web pointer event. Tamagui forwards the DOM
 * event for onPointerEnter/Move; `nativeEvent` is the RN-web fallback.
 */
function cursorXY(e: {
  clientX?: number;
  clientY?: number;
  nativeEvent?: { clientX?: number; clientY?: number };
}): { x: number; y: number } {
  return {
    x: e.clientX ?? e.nativeEvent?.clientX ?? 0,
    y: e.clientY ?? e.nativeEvent?.clientY ?? 0,
  };
}

export function WritingHeatmapChart({
  data,
  isLoading,
  color,
  cellSize = 18,
  months = 6,
}: WritingHeatmapChartProps) {
  const rgb = hexToRgbTriple(color);
  // Hovered/tapped cell. On web `x`/`y` are the cursor's viewport coords, used
  // to float a tooltip right above the pointer; on native (no cursor) the day's
  // words surface in the header line instead.
  const [hovered, setHovered] = useState<{
    date: Date;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  // Auto-scroll the strip to its RIGHT end (today) on first content layout so
  // the most-recent activity is visible without a manual scroll — GitHub's
  // contribution-graph behaviour. `onContentSizeChange` fires on mount + data
  // change but NOT on container resize (cells are fixed-width), so a resize
  // never yanks the view back; the browser just preserves the scroll position.
  const scrollRef = useRef<{
    scrollToEnd?: (opts?: { animated?: boolean }) => void;
  }>(null);

  if (isLoading) {
    return <Skeleton height={200} width="100%" rounded="$3" />;
  }

  const totalWords = data.reduce((sum, d) => sum + (d.words || 0), 0);
  if (totalWords === 0) {
    return (
      <View height={200} items="center" justify="center">
        <Text fontSize="$3" color="$mutedForeground">
          Start journaling to see your writing activity
        </Text>
      </View>
    );
  }

  const cells = data.map((d) => {
    // Parse the yyyy-MM-dd key into a LOCAL date (not `new Date("...")`, which
    // is UTC midnight and can slip a day in negative-offset timezones).
    const [y, m, day] = d.date.split("-").map(Number);
    return {
      date: new Date(y ?? 1970, (m ?? 1) - 1, day ?? 1),
      value: d.words,
    };
  });

  const endDate = startOfDay(new Date());
  const windowStart = new Date(endDate);
  windowStart.setMonth(windowStart.getMonth() - months);
  const blocks = buildMonthBlocks(windowStart, endDate);

  const renderCell = ({ date, value, intensity }: HeatmapCellRenderArgs) => (
    <View
      width={cellSize}
      height={cellSize}
      rounded={Math.max(2, cellSize / 5)}
      bg={fillFor(intensity, rgb) as never}
      cursor="pointer"
      hoverStyle={{
        outlineWidth: 1,
        outlineStyle: "solid",
        outlineColor: `rgba(${rgb}, 1)` as never,
      }}
      // Hover on web (tooltip follows the cursor), tap on native (header line).
      onPointerEnter={
        isWeb
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e: any) => setHovered({ date, value, ...cursorXY(e) })
          : undefined
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPointerMove={
        isWeb
          ? (e: any) => setHovered({ date, value, ...cursorXY(e) })
          : undefined
      }
      onPointerLeave={isWeb ? () => setHovered(null) : undefined}
      onPress={
        isWeb
          ? undefined
          : () =>
              setHovered((h) =>
                h && h.date.getTime() === date.getTime()
                  ? null
                  : { date, value, x: 0, y: 0 },
              )
      }
      {...({
        role: "gridcell",
        "aria-label": `${value} ${value === 1 ? "word" : "words"} on ${date.toDateString()}`,
      } as object)}
    />
  );

  return (
    <YStack flex={1} minH={220} gap="$3">
      <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
        <Text fontSize="$2" color="$mutedForeground">
          {/* On native (no cursor) the tapped day shows here; web uses the
              cursor-following tooltip below. */}
          {hovered && !isWeb
            ? `${hovered.value.toLocaleString()} ${hovered.value === 1 ? "word" : "words"} on ${DAY_FMT.format(hovered.date)}`
            : `${totalWords.toLocaleString()} words in the last ${months} months`}
        </Text>
        <WritingHeatmapLegend rgb={rgb} />
      </XStack>

      {/* Web: floating tooltip that tracks the cursor, sitting just above it.
          `position: fixed` + viewport coords means it's never clipped by the
          card or the horizontal scroller. */}
      {isWeb && hovered ? (
        <View
          position={"fixed" as never}
          t={hovered.y - 40}
          l={hovered.x}
          z={100000}
          bg="$card"
          borderColor="$borderColor"
          borderWidth={1}
          rounded="$2"
          px="$2.5"
          py="$1.5"
          style={
            {
              transform: "translateX(-50%)",
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              whiteSpace: "nowrap",
            } as object
          }
        >
          <Text fontSize="$1" color="$color">
            <Text fontSize="$1" fontWeight="700" color="$color">
              {hovered.value.toLocaleString()}
            </Text>
            {` ${hovered.value === 1 ? "word" : "words"} · ${DAY_FMT.format(hovered.date)}`}
          </Text>
        </View>
      ) : null}

      {/* Centre the tetris row in the remaining card height so it uses the
          vertical space instead of clumping at the top. Scrolls horizontally
          if the months don't fit the cell width. */}
      <YStack flex={1} justify="center">
        <ScrollView
          ref={scrollRef as never}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd?.({ animated: false })
          }
        >
          <XStack gap="$4" items="flex-end">
            {blocks.map((b) => (
              <YStack key={b.key} gap="$1.5" items="center">
                <Heatmap
                  data={cells}
                  startDate={b.start}
                  endDate={b.end}
                  cellSize={cellSize}
                  gap={GAP}
                  levels={LEVELS}
                  showWeekdayLabels={false}
                  showMonthLabels={false}
                  renderCell={renderCell}
                />
                <Text fontSize={11} color="$mutedForeground" fontWeight="500">
                  {b.label}
                </Text>
              </YStack>
            ))}
          </XStack>
        </ScrollView>
      </YStack>
    </YStack>
  );
}

/** "Less □ ▢ ▨ ▩ ■ More" legend using the same journal-yellow ramp. */
function WritingHeatmapLegend({ rgb }: { rgb: string }) {
  return (
    <XStack gap={6} items="center">
      <Text fontSize={10} color="$mutedForeground">
        Less
      </Text>
      <XStack gap={2}>
        {Array.from({ length: LEVELS }, (_, i) => (
          <View
            key={i}
            width={10}
            height={10}
            rounded={2}
            bg={fillFor(i, rgb) as never}
          />
        ))}
      </XStack>
      <Text fontSize={10} color="$mutedForeground">
        More
      </Text>
    </XStack>
  );
}
