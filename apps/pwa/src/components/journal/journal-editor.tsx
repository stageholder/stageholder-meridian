import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { generateJSON } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { RichTextEditor, Text, XStack, YStack } from "@stageholder/ui";
import { countWordsFromContent } from "@repo/core/utils/text";
import type { JournalContent } from "@repo/core/types";
import { useUserLight } from "@/lib/api/light";
import { useJournals } from "@/lib/api/journals";
import { JournalCelebration } from "./journal-celebration";
import type { SaveStatus } from "@/lib/hooks/use-autosave";

/**
 * Journal-entry rich text editor — wraps `@stageholder/ui`'s
 * `<RichTextEditor>` so meridian gets the kit's toolbar, chrome, and
 * cross-platform parity with mobile/desktop (10tap emits the same JSON).
 *
 * Phase 2 — Dual-format read, JSON write
 * ───────────────────────────────────────
 * Meridian is migrating journal storage from HTML strings to TipTap JSON
 * via lazy backfill. During the migration window this editor:
 *
 *   - **Reads** either format. Legacy entries (`content: string`) are
 *     converted HTML → JSON via `generateJSON()` on first load. New
 *     entries (`content: object`) are passed straight to the editor.
 *   - **Writes** JSON. Every onChange emits a TipTap JSON object; the
 *     parent autosave persists it back as JSON. The next load reads
 *     JSON natively (no more shim) and the row is effectively migrated.
 *
 * The encryption layer (`journal-crypto.ts`) does the same discrimination
 * after decrypt — so encrypted legacy entries also lazy-migrate on first
 * save without the user noticing.
 *
 * Kit props in use:
 *   - `toolbar="basic"` — hides round-trip-unsafe features (Highlight,
 *     TextAlign, Sup/Sub, Image) for the legacy-HTML transition window.
 *     Bump to `"full"` once Phase 2 PR4 lands and we drop @tiptap/html.
 *   - `variant="inline"` — drops the kit Frame's bg/border/rounded so the
 *     editor reads as a flowing page composition.
 *   - `toolbarSlot` — autosave status sits inline with the toolbar.
 *
 * Meridian-specific UX preserved as siblings (not inside the kit editor):
 *   - `<JournalCelebration>` — full-screen confetti when crossing daily target
 *   - Word-target progress bar at the bottom — tied to `useUserLight()`
 */
interface JournalEditorProps {
  // Dual-format during the Phase 2 migration window — string (legacy HTML)
  // or JSONContent (new TipTap JSON). The editor handles both on input;
  // onChange always emits JSON going forward.
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
// StarterKit + Placeholder covers the round-trip-safe primitives that
// the meridian Phase 1 shim emitted (paragraph, heading, list,
// blockquote, code, bold, italic, code mark, strike). This list is
// import-only now — we never serialize JSON→HTML again post Phase 2.
const LEGACY_HTML_EXTENSIONS = [StarterKit, Placeholder];

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/**
 * Normalize incoming `content` (either format) into the JSON shape the
 * kit editor expects. Legacy HTML strings go through `generateJSON`
 * once; JSON objects pass straight through (no copy).
 */
function normalizeToJson(content: JournalContent): JSONContent {
  if (content === null || content === undefined) return EMPTY_DOC;
  if (typeof content === "object") return content as JSONContent;
  // string from here on — legacy HTML
  if (!content || content.trim() === "") return EMPTY_DOC;
  try {
    return generateJSON(content, LEGACY_HTML_EXTENSIONS) as JSONContent;
  } catch {
    // Malformed legacy HTML — fall back to empty doc rather than crash.
    // Shouldn't happen in practice (Phase 1 always emitted valid HTML),
    // but defensive coding around user-content storage is worth it.
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
  // Word count works across both formats via the shared dispatcher in
  // @repo/core/utils/text — string → strip HTML tags; JSONContent →
  // walk the ProseMirror tree.
  const [wordCount, setWordCount] = useState(() =>
    countWordsFromContent(content),
  );

  // Fetch all entries for the same day to compute cumulative word count
  const { data: dailyEntries } = useJournals(
    date ? { startDate: date, endDate: date } : undefined,
  );

  const otherWordsToday = useMemo(() => {
    if (!dailyEntries) return 0;
    return dailyEntries
      .filter((entry) => entry.id !== excludeJournalId)
      .reduce((sum, entry) => sum + entry.wordCount, 0);
  }, [dailyEntries, excludeJournalId]);

  const totalWords = wordCount + otherWordsToday;

  // Track target celebration — fire once per crossing
  const prevMetRef = useRef(false);
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);
  const [showGlow, setShowGlow] = useState(false);

  useEffect(() => {
    const nowMet = totalWords >= target && target > 0;
    if (nowMet && !prevMetRef.current) {
      prevMetRef.current = true;
      setCelebrationTrigger((n) => n + 1);
      setShowGlow(true);
      const timer = setTimeout(() => setShowGlow(false), 2500);
      return () => clearTimeout(timer);
    }
    prevMetRef.current = nowMet;
  }, [totalWords, target]);

  // Editor controlled value is always JSON. `content` may arrive as a
  // legacy HTML string (read from a pre-Phase-2 row) or as a TipTap JSON
  // object (read from a Phase-2 row). `normalizeToJson` handles both.
  const [json, setJson] = useState<JSONContent>(() => normalizeToJson(content));

  // Push external `content` changes into the editor when they don't match
  // what's already there. We compare on the *incoming* shape directly:
  //   - If incoming is JSON, deep-compare via JSON.stringify (cheap, and
  //     stable across keystrokes because we control the JSON we emit).
  //   - If incoming is a string, treat any change as a fresh import (the
  //     parent is asking us to reset to that legacy HTML).
  // Skipping when in sync avoids clobbering the user's cursor mid-edit.
  // `json` is intentionally omitted from deps: including it would re-run
  // on every keystroke (since we setJson in handleEditorChange) and
  // create an infinite loop.
  useEffect(() => {
    if (typeof content === "string") {
      // Legacy HTML coming in — always re-normalize. This branch fires
      // exactly once per row's lifetime (the next save emits JSON).
      setJson(normalizeToJson(content));
    } else {
      const incoming = JSON.stringify(content);
      const current = JSON.stringify(json);
      if (incoming !== current) {
        setJson(content as JSONContent);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const handleEditorChange = useCallback(
    (next: JSONContent) => {
      setJson(next);
      setWordCount(countWordsFromContent(next));
      // Always emit JSON. The parent autosave persists it; subsequent
      // reads return JSON natively. No more HTML round-trips.
      onChange(next);
    },
    [onChange],
  );

  const pct = Math.min(100, (totalWords / target) * 100);
  const metTarget = totalWords >= target;

  // Toolbar-right slot: just save status. The word count moved out — it
  // now travels along the meridian line as the moving label (see
  // `MeridianProgress` below), making the visual indicator itself
  // textually informative. No duplicate count in the toolbar.
  const headerCluster =
    saveStatus && saveStatus !== "idle" ? (
      <Text
        fontSize={11}
        color={saveStatus === "error" ? "$destructive" : "$mutedForeground"}
      >
        {saveStatus === "saving" && "Saving…"}
        {saveStatus === "saved" && "✓ Saved"}
        {saveStatus === "error" && "Save failed"}
      </Text>
    ) : null;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Celebration overlay — covers the entire editor */}
      <JournalCelebration trigger={celebrationTrigger} />

      {/* HERO: the meridian line + traveling label. Reads as the day's
          progress narrative — a horizon you cross as you write. The
          word count is *embedded* in the indicator itself (the label
          moves along the line), so the count is both the visual and the
          information. Brand-aligned: Meridian = the line the sun
          crosses at noon. */}
      <MeridianProgress
        percent={pct}
        glow={showGlow}
        met={metTarget}
        current={totalWords}
        target={target}
      />

      {/* Kit editor — toolbar (with formatting + the compact count/save
          cluster on the right) above the writing body. variant="inline"
          so the frame stays borderless and flows into the page chrome.
          The `journal-editor-body` className scopes CSS overrides in
          globals.css (padding alignment + text cursor over empty space).

          onPress: clicking anywhere in the editor body area (including
          the empty space below the text content) focuses the
          contenteditable and places the cursor at the end. This is the
          standard Notion/Bear/Day One behavior — the entire writing
          panel feels like one typing surface, not a tiny clickable box.
          Toolbar buttons + ProseMirror itself are excluded so they
          handle their own click semantics. */}
      <YStack
        flex={1}
        overflow="scroll"
        className="journal-editor-body"
        onPress={focusEditorOnDeadZoneClick}
      >
        <RichTextEditor
          value={json}
          onChange={handleEditorChange}
          placeholder={placeholder ?? "Write your thoughts..."}
          autoFocus={autoFocus}
          minHeight={300}
          toolbar="basic"
          variant="inline"
          toolbarSlot={headerCluster}
        />
      </YStack>
    </div>
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
 * Tamagui's onPress on web maps to a DOM event; we cast through
 * `unknown` to keep the assertion localised.
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
 * `JournalCelebration` overlay below.
 *
 * Position clamping: the chip's CENTER is clamped to [10%, 90%] so the
 * pill never clips off the page edges at the extremes. The trail's
 * actual end stays at the true `percent` — visual progress accuracy
 * is preserved even when the chip is clamped.
 *
 * The metaphor: Meridian is the line the sun crosses at noon. The chip
 * is your travelling marker — sunrise at the left edge, the meridian
 * crossing at the right edge.
 */
function MeridianProgress({
  percent,
  glow,
  met,
  current,
  target,
}: {
  percent: number;
  glow: boolean;
  met: boolean;
  current: number;
  target: number;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const trackHeight = glow ? 5 : 3;

  // The thumb is part of the bar itself — a pill-shaped indicator that
  // sits ON the track at the trail's leading edge, colored to match
  // the trail so the trail visually "ends" at the thumb. Two-line
  // content: count on the top line, "Words" beneath. Sized for that
  // two-line layout (taller, slightly wider).
  const THUMB_WIDTH = 64;
  const THUMB_HEIGHT = 36;

  // Measure the strip width so positions are pixel-precise.
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

  // Trail's leading edge in pixels — where the colored fill ends.
  const trailLeadingPx = stripWidth === 0 ? 0 : (clamped / 100) * stripWidth;

  // Thumb's CENTER position. Conceptually it sits at the trail's leading
  // edge. Clamped to keep the thumb fully visible:
  //   - min: THUMB_WIDTH/2 (thumb's left edge stays at strip's left)
  //   - max: stripWidth - THUMB_WIDTH/2 (thumb's right edge stays at
  //     strip's right edge → no right buffer needed, the thumb
  //     naturally has space because it's clamped)
  const thumbCenterPx =
    stripWidth === 0
      ? THUMB_WIDTH / 2
      : Math.max(
          THUMB_WIDTH / 2,
          Math.min(stripWidth - THUMB_WIDTH / 2, trailLeadingPx),
        );
  const thumbLeftPx = thumbCenterPx - THUMB_WIDTH / 2;

  return (
    <div
      ref={stripRef}
      className="relative shrink-0 w-full overflow-visible"
      style={{ height: 48, marginBottom: 12 }}
    >
      {/* Track — gray rail spanning full width, vertically centered. */}
      <div
        className="absolute left-0 right-0 rounded-full bg-border/40"
        style={{
          top: "50%",
          marginTop: -trackHeight / 2,
          height: trackHeight,
          transition: "height 400ms ease",
        }}
      />

      {/* Filled trail — colored fill from 0 to trailLeadingPx, ends
          exactly where the thumb's center sits. */}
      <div
        className="absolute left-0 rounded-full"
        style={{
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

      {/* Thumb — a pill embedded in the bar at the trail's leading
          edge. Two-line content: count on top, "Words" beneath.
          Colored to match the trail so they read as one continuous
          element. */}
      <div
        className="absolute"
        style={{
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
          className="tabular-nums"
          style={{
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
