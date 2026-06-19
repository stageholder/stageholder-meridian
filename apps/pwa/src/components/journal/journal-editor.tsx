import { useEffect, useMemo, useRef, useState } from "react";
import { generateJSON } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Text, YStack } from "@stageholder/ui";
import {
  JournalEditor as JournalEditorView,
  BLOCK_GUTTER,
  type JournalProgressState,
  type SaveStatus,
} from "@repo/features/journal";
import type { JournalContent } from "@repo/core/types";
import { useUserLight } from "@/lib/api/light";
import { useJournals } from "@/lib/api/journals";
import { JournalCelebration } from "./journal-celebration";

/**
 * PWA wrapper around the cross-platform `JournalEditor` view from
 * `@repo/features/journal`.
 *
 * Owns three things the view deliberately doesn't:
 *
 *  1. **Legacy HTML → JSON normalization.** Meridian is still in the
 *     middle of migrating journal storage from HTML strings to TipTap
 *     JSON via lazy backfill. Doing the import here keeps `@tiptap/html`
 *     (and the StarterKit + Placeholder used by `generateJSON`) out of
 *     `@repo/features`. Once the migration completes this normalization
 *     is deleted and the prop becomes `JSONContent` end-to-end.
 *
 *  2. **Data wiring** — `useUserLight()` for the daily target,
 *     `useJournals({ startDate: date, endDate: date })` for the
 *     same-day-other-entries word count.
 *
 *  3. **Web-only visual chrome** — `<MeridianProgress>` (px-precise
 *     ResizeObserver-driven bar with CSS color-mix gradients) and
 *     `<JournalCelebration>` (CSS keyframe confetti + fire embers),
 *     wired in via the view's `renderProgress` / `renderCelebration`
 *     render-props. Plus the dead-zone click handler that uses DOM
 *     Selection / Range to put the cursor at the end of the document
 *     when the user clicks below the text — a Notion/Bear pattern that
 *     needs the web-specific `document.createRange` API.
 */

interface JournalEditorProps {
  // Dual-format during the Phase 2 migration window — string (legacy HTML)
  // or JSONContent (new TipTap JSON). The wrapper normalizes both into
  // JSON before handing off; onChange always emits JSON going forward.
  content: JournalContent;
  onChange: (content: JSONContent) => void;
  placeholder?: string;
  autoFocus?: boolean;
  date?: string;
  excludeJournalId?: string;
  saveStatus?: SaveStatus;
}

// Extensions used by `@tiptap/html`'s `generateJSON` for the legacy-HTML
// import path. Must be a SUBSET of the kit RichTextEditor's internal
// extensions so any node/mark in the imported HTML can be parsed back.
// Import-only — we never serialize JSON → HTML again post Phase 2.
const LEGACY_HTML_EXTENSIONS = [StarterKit, Placeholder];

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function normalizeToJson(content: JournalContent): JSONContent {
  if (content === null || content === undefined) return EMPTY_DOC;
  if (typeof content === "object") return content as JSONContent;
  if (!content || content.trim() === "") return EMPTY_DOC;
  try {
    return generateJSON(content, LEGACY_HTML_EXTENSIONS) as JSONContent;
  } catch {
    // Malformed legacy HTML — fall back to empty doc rather than crash.
    return EMPTY_DOC;
  }
}

export function JournalEditor({
  content,
  onChange,
  placeholder,
  autoFocus,
  date,
  excludeJournalId,
  saveStatus,
}: JournalEditorProps) {
  const { data: userLight } = useUserLight();
  const target = userLight?.journalTargetDailyWords ?? 75;

  const { data: dailyEntries } = useJournals(
    date ? { startDate: date, endDate: date } : undefined,
  );

  const otherWordsToday = useMemo(() => {
    if (!dailyEntries) return 0;
    return dailyEntries
      .filter((entry) => entry.id !== excludeJournalId)
      .reduce((sum, entry) => sum + entry.wordCount, 0);
  }, [dailyEntries, excludeJournalId]);

  // Normalize once at mount — the view is uncontrolled and stores its
  // own document, so a new `content` prop on every parent re-render
  // would never reach the editor anyway. Re-mount via `key` to load a
  // different entry (the routes already do this).
  const [initialContent] = useState<JSONContent>(() =>
    normalizeToJson(content),
  );

  return (
    // No horizontal padding here: the journal content's only horizontal inset
    // is the block drag-handle gutter (BLOCK_GUTTER) — the body text gets it
    // from the variant, the progress strip + title + metadata get the same
    // value applied directly, so everything shares one left/right edge with no
    // extra column padding stacked on top. `minHeight={0}` lets the inner
    // scroll region size down.
    <YStack flex={1} minH={0} position="relative">
      <JournalEditorView
        initialContent={initialContent}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        target={target}
        otherWordsToday={otherWordsToday}
        // allowlist: journal-editor-body scopes globals.css overrides for the
        // TipTap/ProseMirror editor chrome (padding alignment + text cursor
        // over the empty dead-zone) — editor-specific CSS, no token equiv.
        editorBodyClassName="journal-editor-body"
        onEditorBodyPress={focusEditorOnDeadZoneClick}
        renderCelebration={(trigger) => (
          <JournalCelebration trigger={trigger} />
        )}
        // Inset the progress bar by the block drag-handle gutter on BOTH sides
        // so it lines up with the symmetrically-inset body text below (and with
        // the title/metadata, which get the same left inset in the route
        // headers).
        renderProgress={(state) => (
          <YStack px={BLOCK_GUTTER}>
            <MeridianProgress {...state} />
          </YStack>
        )}
      />

      {/* Autosave status — a floating bottom-right chip (Google-Docs style).
          The block editor has no toolbar to host it; this is web-only chrome,
          so it lives in the PWA host rather than the cross-platform view
          (native shows no inline save badge). `pointerEvents="none"` keeps
          clicks falling through to the editor. */}
      {saveStatus && saveStatus !== "idle" ? (
        <YStack
          position="absolute"
          b="$3"
          r="$3"
          z={20}
          pointerEvents="none"
          bg="$background"
          px="$2"
          py="$1"
          rounded="$10"
          opacity={0.9}
        >
          <Text
            fontSize={11}
            color={saveStatus === "error" ? "$destructive" : "$mutedForeground"}
          >
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "✓ Saved"}
            {saveStatus === "error" && "Save failed"}
          </Text>
        </YStack>
      ) : null}
    </YStack>
  );
}

/**
 * Click handler for the editor body wrapper's "dead zone" — the empty
 * area below the ProseMirror content where clicks would otherwise do
 * nothing. We:
 *   1. Bail if the click landed on a toolbar button (it has its own
 *      click semantics) or inside the ProseMirror (TipTap places the
 *      cursor itself).
 *   2. Otherwise focus the contenteditable and collapse the selection
 *      to the END of the content — matching how Notion/Bear/Day One
 *      treat clicks in the area below the text.
 *
 * Web-only — uses `document.createRange` + `window.getSelection`. Mobile
 * doesn't need this (taps inside the editor always land on text via
 * the native 10tap input handlers).
 */
function focusEditorOnDeadZoneClick(event: unknown): void {
  const e = event as {
    target: EventTarget | null;
    currentTarget: EventTarget | null;
  };
  const target = e.target as HTMLElement | null;
  const wrapper = e.currentTarget as HTMLElement | null;
  if (!target || !wrapper) return;
  if (target.closest("button") || target.closest(".ProseMirror")) return;
  const editor = wrapper.querySelector(".ProseMirror") as HTMLElement | null;
  if (!editor) return;
  editor.focus({ preventScroll: false });
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/**
 * Meridian progress line — the hero visualization for daily word target.
 *
 * Visual: a horizontal track spanning the full editor width with a
 * pill/chip travelling along it at the position of the user's current
 * progress. The trail fills LTR behind the chip with the journal accent
 * color, so the chip appears to "lead" the trail across the meridian.
 * The chip itself shows the explicit count ("24/75 Words") and slides
 * smoothly with each word typed.
 *
 * Crossing the daily target: chip flips to brand color + bold + soft
 * glow halo, trail fills solid, track thickens. Pairs with the
 * `JournalCelebration` overlay.
 *
 * Position clamping: the chip's CENTER is clamped to [10%, 90%] so the
 * pill never clips off the page edges at the extremes. The trail's
 * actual end stays at the true `percent` — visual progress accuracy
 * is preserved even when the chip is clamped.
 *
 * Web-only — uses ResizeObserver for pixel-precise positioning, CSS
 * color-mix for the trail gradient, and CSS transitions on measured
 * px values. Mobile will ship a kit-Progress equivalent (or omit the
 * progress visual entirely on small screens).
 */
function MeridianProgress({
  percent,
  glow,
  met,
  current,
  target,
}: JournalProgressState) {
  const clamped = Math.min(100, Math.max(0, percent));
  const trackHeight = glow ? 5 : 3;

  const THUMB_WIDTH = 64;
  const THUMB_HEIGHT = 36;

  const stripRef = useRef<HTMLDivElement>(null);
  const [stripWidth, setStripWidth] = useState(0);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    setStripWidth(el.offsetWidth);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setStripWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const trailLeadingPx = stripWidth === 0 ? 0 : (clamped / 100) * stripWidth;

  const thumbCenterPx =
    stripWidth === 0
      ? THUMB_WIDTH / 2
      : Math.max(
          THUMB_WIDTH / 2,
          Math.min(stripWidth - THUMB_WIDTH / 2, trailLeadingPx),
        );
  const thumbLeftPx = thumbCenterPx - THUMB_WIDTH / 2;

  return (
    // The meridian progress strip is a measured, pixel-precise visualization —
    // ResizeObserver-driven left/width in raw px, CSS-var theming
    // (var(--ring-journal)/var(--background)), color-mix(in oklch, …)
    // gradients + glow, and per-property CSS transitions on the measured
    // positions. No Tamagui token/transition equivalent; kept as styled DOM
    // (all inline styles, no utility classes). fontVariantNumeric on the count
    // keeps the digits from jittering as they tick.
    <div
      ref={stripRef}
      style={{
        position: "relative",
        flexShrink: 0,
        width: "100%",
        overflow: "visible",
        height: 48,
        marginBottom: 12,
      }}
    >
      {/* No empty track rail: the faint full-width line (drawn in the border
          color) read as a stray border across the writing surface, so it's
          intentionally omitted. Only the filled trail + count pill render —
          progress shows as the journal-accent fill growing LTR from the left
          edge, with nothing visible at zero words. */}

      {/* Filled trail */}
      <div
        style={{
          position: "absolute",
          left: 0,
          borderRadius: 9999,
          top: "50%",
          marginTop: -trackHeight / 2,
          width: trailLeadingPx,
          height: trackHeight,
          background: met
            ? "var(--ring-journal)"
            : "linear-gradient(90deg, color-mix(in oklch, var(--ring-journal) 50%, transparent) 0%, var(--ring-journal) 100%)",
          transition:
            "width 500ms ease, height 400ms ease, background 600ms ease",
          boxShadow: glow
            ? "0 0 12px color-mix(in oklch, var(--ring-journal) 60%, transparent)"
            : "none",
        }}
      />

      {/* Thumb pill — count + "Words" */}
      <div
        style={{
          position: "absolute",
          left: thumbLeftPx,
          top: "50%",
          width: THUMB_WIDTH,
          height: THUMB_HEIGHT,
          marginTop: -THUMB_HEIGHT / 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          borderRadius: 9999,
          background: "var(--ring-journal)",
          color: "var(--background)",
          boxShadow: glow
            ? "0 0 14px color-mix(in oklch, var(--ring-journal) 65%, transparent), 0 1px 2px rgba(0,0,0,0.15)"
            : "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)",
          transition:
            "left 500ms ease, background 500ms ease, box-shadow 600ms ease",
          willChange: "left",
        }}
      >
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: 0.2,
          }}
        >
          {current}/{target}
        </span>
        <span
          style={{
            fontSize: 8,
            fontWeight: 500,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            opacity: 0.85,
            lineHeight: 1,
          }}
        >
          Words
        </span>
      </div>
    </div>
  );
}
