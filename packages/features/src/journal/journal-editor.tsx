import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  RichTextEditor,
  Text,
  YStack,
  type RichTextEditorContent,
} from "@stageholder/ui";
import { countWordsFromContent } from "@repo/core/utils/text";

// The kit's `RichTextEditorContent` IS TipTap's `JSONContent` (re-exported)
// — using it keeps `@tiptap/core` out of features' direct deps. Hosts that
// still need the raw TipTap type alias it themselves.
type JSONContent = RichTextEditorContent;

/**
 * Save status for the inline indicator in the toolbar slot. Mirrors the
 * PWA's `use-autosave` SaveStatus union so the host can pass its hook's
 * value straight through. Cross-platform — both the web autosave hook
 * and any future mobile equivalent emit the same shape.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Derived state passed to the optional `renderProgress` render-prop.
 * Hosts use this to draw the (web-only) px-precise meridian progress
 * strip without the view itself having to know about ResizeObserver,
 * CSS color-mix, or any other web chrome.
 */
export interface JournalProgressState {
  /** Total words written today (this editor + sibling entries). */
  current: number;
  /** The daily word target (host-supplied). */
  target: number;
  /** `current / target` clamped to [0, 100]. */
  percent: number;
  /** `current >= target && target > 0`. */
  met: boolean;
  /** Briefly true (~2.5s) right after first crossing — drives the glow. */
  glow: boolean;
}

export interface JournalEditorProps {
  /**
   * Initial editor content as TipTap JSON. The view is uncontrolled
   * after mount — it captures this value once and the kit editor owns
   * its document from there on. To load a different entry, the host
   * remounts via `key`. (Pushing `value` back as a prop on every
   * onChange collapses the cursor mid-typing — the PWA learned this
   * the hard way; preserved here.)
   *
   * Hosts that store legacy HTML normalize HTML → JSON before passing
   * in. Keeping `@tiptap/html` out of this view means `@repo/features`
   * doesn't take it as a dep, and once the migration completes only
   * the wrapper needs touching.
   */
  initialContent: JSONContent;
  /** Fires on every keystroke with the editor's full JSON document. */
  onChange: (json: JSONContent) => void;
  /** Empty-state placeholder. */
  placeholder?: string;
  /** Focus the editor on mount. Default `false`. */
  autoFocus?: boolean;
  /** When set + non-idle, shows an inline save badge in the toolbar slot. */
  saveStatus?: SaveStatus;

  /** Daily word target (host fetches via its own user-light hook). */
  target: number;
  /**
   * Words already written today in OTHER entries — the host queries the
   * day's journals and subtracts the current entry. Added to the local
   * `wordCount` to drive `current` in the progress + crossing trigger.
   */
  otherWordsToday: number;

  /**
   * Optional progress visual rendered ABOVE the editor. Web ships a
   * pixel-precise meridian bar (ResizeObserver-driven); native can pass
   * a simpler kit progress component or omit it entirely. Receives the
   * latest derived `JournalProgressState`.
   */
  renderProgress?: (state: JournalProgressState) => ReactNode;
  /**
   * Optional celebration overlay rendered above the editor (z-stacked).
   * The view bumps `trigger` once per target-crossing — hosts pass that
   * to their celebration component (web: confetti / fire embers; native:
   * lighter-weight equivalent).
   */
  renderCelebration?: (trigger: number) => ReactNode;
  /**
   * Web-only escape hatch — receives the wrapper's onPress so the PWA
   * can implement Notion/Bear-style "click in dead-zone to focus
   * editor" behavior. Mobile leaves this undefined.
   */
  onEditorBodyPress?: (event: unknown) => void;
  /**
   * Optional className applied to the inner editor-body wrapper. Used
   * by the PWA to scope `globals.css` overrides for the ProseMirror
   * surface; harmless on native.
   */
  editorBodyClassName?: string;
}

/**
 * Cross-platform journal editor — wraps the kit's `<RichTextEditor>`
 * with meridian's word-count + daily-target machinery. The kit editor is
 * truly cross-platform (TipTap on web, 10tap on native; identical TipTap
 * JSON storage), so this view runs identically on both targets.
 *
 * What the view owns (cross-platform):
 *  - The kit `<RichTextEditor>` with meridian's toolbar/variant/min-height.
 *  - Live word count via the shared `countWordsFromContent` dispatcher.
 *  - Target-crossing detection — `useRef` + `useEffect` fire `trigger++`
 *    exactly once when the user first crosses their daily target.
 *  - Inline save-status badge in the toolbar's right slot.
 *
 * What the host owns (web vs native):
 *  - Legacy HTML → JSON normalization (kept out of features to avoid
 *    `@tiptap/html` as a dep).
 *  - The progress visual + celebration overlay (web-only CSS keyframes
 *    + pixel-precise ResizeObserver positioning).
 *  - The dead-zone click handler (DOM Selection / Range APIs).
 */
export function JournalEditor({
  initialContent,
  onChange,
  placeholder,
  autoFocus,
  saveStatus,
  target,
  otherWordsToday,
  renderProgress,
  renderCelebration,
  onEditorBodyPress,
  editorBodyClassName,
}: JournalEditorProps) {
  const [wordCount, setWordCount] = useState(() =>
    countWordsFromContent(initialContent),
  );

  const totalWords = wordCount + otherWordsToday;

  // Fire the celebration exactly once per crossing (not on every keystroke
  // once the target is met). The ref tracks the previous met-state so we
  // see the transition rather than the steady state.
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

  const handleEditorChange = useCallback(
    (next: JSONContent) => {
      setWordCount(countWordsFromContent(next));
      onChange(next);
    },
    [onChange],
  );

  const progress: JournalProgressState = useMemo(
    () => ({
      current: totalWords,
      target,
      percent: target > 0 ? Math.min(100, (totalWords / target) * 100) : 0,
      met: totalWords >= target && target > 0,
      glow: showGlow,
    }),
    [totalWords, target, showGlow],
  );

  // Toolbar-right slot: compact save status. Word count rides the
  // meridian progress visual itself (when the host renders one); no
  // duplicate count in the toolbar.
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
    <YStack position="relative" flex={1} overflow="hidden">
      {renderCelebration?.(celebrationTrigger)}
      {renderProgress?.(progress)}

      <YStack
        flex={1}
        overflow="scroll"
        className={editorBodyClassName}
        onPress={onEditorBodyPress}
      >
        <RichTextEditor
          value={initialContent}
          onChange={handleEditorChange}
          placeholder={placeholder ?? "Write your thoughts..."}
          autoFocus={autoFocus}
          minHeight={300}
          toolbar="basic"
          variant="inline"
          toolbarSlot={headerCluster}
        />
      </YStack>
    </YStack>
  );
}
