// SmartTodoInput (NATIVE) — 10tap/tentap implementation.
//
// WHY a WebView editor: native RN cannot render a ROUNDED background on an inline
// text run (react-native#10807 persists on Fabric) — the only way to get the
// Todoist-style rounded inline highlight from the design is a browser, i.e. the
// tentap (TipTap-in-WebView) editor the kit already depends on. A highlight then
// becomes a CSS `<span>` with border-radius + padding + box-decoration-break.
//
// Phases (each a device screenshot checkpoint):
//   • PHASE 1: bare editor — controlled value, text I/O, placeholder, height,
//     focus, parser→pills (onParse). ✅
//   • PHASE 2: rounded inline highlights — a custom editor bundle
//     (`editor-web/`, passed as `customSource`) carries a ProseMirror decoration
//     plugin; RN pushes the parser's token ranges + colours via `injectJS` →
//     `window.__setSmartTokens`, and `.smart-token` CSS (injected below) paints
//     them as rounded pills. ✅
//   • PHASE 3 (next): the `!`/`#` picker (native menu via getSelection +
//     insertText).
//
// The public contract (props, `onParse`, `onSubmit`, ref `focus`) is identical
// to the web sibling, so the host `QuickAddTodoSheet` needs no changes. The web
// file (`smart-todo-input.tsx`) is untouched — this `.native` split is the only
// place the WebView editor loads.
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useTheme } from "tamagui";
import { Flag, Inbox } from "@tamagui/lucide-icons-2";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import {
  CoreBridge,
  RichText,
  TenTapStartKit,
  useBridgeState,
  useEditorBridge,
  useEditorContent,
} from "@10play/tentap-editor";
import {
  parseSmartTodo,
  type SmartParseResult,
  type SmartToken,
} from "@repo/core/todos/smart-parse";
import { resolveSmartLocale } from "@repo/core/todos/date-parse";
import type {
  SmartListOption,
  SmartTodoInputHandle,
  SmartTodoInputProps,
} from "./smart-todo-input.types";
import { QUICK_ADD_EDITOR_HTML } from "./quick-add-editor-html";

// Todo-red caret, matching the web composer.
const TODO_RED = "#ef4444";
// Highlight fill per token kind (same language as the web pills / native chips).
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};
/** Solid fill for a recognized token — white pill text sits on it. */
function tokenColor(token: SmartToken, lists: SmartListOption[]): string {
  switch (token.kind) {
    case "do":
    case "due":
      return TODO_RED;
    case "priority":
      return PRIORITY_COLOR[token.value] ?? TODO_RED;
    case "list":
      return lists.find((l) => l.id === token.value)?.color || "#6b7280";
  }
}

// `!` menu options — the WORD form is inserted (reads better in the title than
// `!p1`), but the P-code is matched too so typing `!p2` filters.
const PRIORITY_OPTIONS = [
  { value: "urgent", code: "p1", label: "Urgent" },
  { value: "high", code: "p2", label: "High" },
  { value: "medium", code: "p3", label: "Medium" },
  { value: "low", code: "p4", label: "Low" },
] as const;

/** 6-digit hex → ~15% alpha tint; anything else → a neutral tint. */
function tint(hex?: string): string {
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}26` : "#8888881f";
}

interface ActiveTrigger {
  char: "!" | "#";
  /** Index of the trigger char in the text. */
  start: number;
  /** Query typed after the trigger (may be empty). */
  query: string;
}

/** Detect an in-progress `!`/`#` trigger immediately left of the caret — the
 *  trigger char must start the word (string start or after whitespace). */
function detectTrigger(value: string, caret: number): ActiveTrigger | null {
  const m = /(^|\s)([!#])(\S*)$/.exec(value.slice(0, caret));
  if (!m) return null;
  const query = m[3] ?? "";
  return { char: m[2] as "!" | "#", start: caret - query.length - 1, query };
}
// The WebView needs a DEFINITE height or it collapses to 0px inside a sheet (the
// kit hit this with a flex-sized tentap field). Two lines' worth for a title;
// content past it scrolls internally. Auto-grow is a later refinement.
const FIELD_HEIGHT = 64;

/** CSS injected into the editor WebView: compact single-field typography, a
 *  transparent canvas, the empty placeholder, and the `.smart-token` pills. The
 *  placeholder TEXT is painted literally here (not via `attr(data-placeholder)`)
 *  because tentap's runtime `setPlaceholder` proved unreliable through the
 *  customSource bridge — the empty-node's `is-editor-empty` class (added by the
 *  StartKit Placeholder extension) is all we rely on. */
function buildCss(
  fg: string,
  placeholderColor: string,
  placeholderText: string,
): string {
  // Match the app's system font — a WebView defaults to serif (Times) otherwise.
  const FONT_STACK =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  return `
    html, body { background: transparent; margin: 0; padding: 0; }
    .ProseMirror {
      padding: 10px 12px; margin: 0;
      font-family: ${FONT_STACK};
      font-size: 16px; line-height: 22px;
      color: ${fg}; caret-color: ${TODO_RED};
      -webkit-user-select: text;
    }
    .ProseMirror:focus { outline: none; }
    .ProseMirror p { margin: 0; }
    .ProseMirror p.is-editor-empty:first-child::before {
      content: ${JSON.stringify(placeholderText)};
      color: ${placeholderColor};
      float: left; height: 0; pointer-events: none;
    }
    /* Rounded inline highlight pill (background colour rides inline per token).
       box-decoration-break:clone keeps the rounding intact when a phrase wraps. */
    .smart-token {
      color: #ffffff;
      border-radius: 6px;
      padding: 1px 5px;
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
  `;
}

export const SmartTodoInput = forwardRef<
  SmartTodoInputHandle,
  SmartTodoInputProps
>(function SmartTodoInput(
  {
    value,
    onValueChange,
    lists,
    now,
    locale,
    placeholder,
    autoFocus,
    parse = true,
    onParse,
  },
  ref,
) {
  const theme = useTheme();
  const fg = theme.color?.val ?? "#000";
  const placeholderColor =
    theme.placeholderColor?.val ?? theme.mutedForeground?.val ?? "#888";

  const css = useMemo(
    () => buildCss(fg, placeholderColor, placeholder ?? ""),
    [fg, placeholderColor, placeholder],
  );

  // Captured ONCE. Passing the live `value` here re-seeds the document on every
  // keystroke (clear-then-restore = a visible blink); external changes flow
  // through the setContent effect below instead.
  const initialContent = useRef(value || "").current;
  // Stable extension list — an inline array would give `editor.bridgeExtensions`
  // (and RichText's injected JS) a new identity every render.
  const bridgeExtensions = useMemo(
    () => [...TenTapStartKit, CoreBridge.configureCSS(css)],
    [css],
  );
  const editor = useEditorBridge({
    // Plain string is valid tentap `Content` — it becomes a single paragraph.
    initialContent,
    bridgeExtensions,
    // Our custom web bundle: default tentap editor + the smart-highlight
    // decoration plugin + the window.__setSmartTokens hook.
    customSource: QUICK_ADD_EDITOR_HTML,
    autofocus: autoFocus,
    avoidIosKeyboard: true,
  });

  // Re-inject CSS on theme change (idempotent — same id replaces the prior one).
  useEffect(() => {
    editor.injectCSS(css, "smart-todo-theme");
  }, [css, editor]);

  useImperativeHandle(ref, () => ({ focus: () => editor.focus() }), [editor]);

  // ── Controlled value round-trip (mirrors the kit's tentap pattern) ──
  // `lastEmitted` distinguishes the editor's own typing echo from an EXTERNAL
  // change (the sheet clearing the title on open), so we never call setContent
  // mid-typing — which would reset the WebView caret.
  const lastEmitted = useRef(value);

  // Editor text → parent. tentap can append a trailing newline; strip it so the
  // title stays clean.
  const emitted = useEditorContent(editor, { type: "text" });
  useEffect(() => {
    if (emitted === undefined) return;
    const t = (emitted as string).replace(/\n+$/, "");
    lastEmitted.current = t;
    if (t !== value) onValueChange(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitted]);

  // External `value` change (e.g. the sheet clearing the title on open) → push
  // into the editor. Deps are `[value]` ONLY — deliberately NOT `editor`.
  // `useEditorBridge` returns a NEW `editor` object every render, so including
  // it would run this effect on every render; in the render where the debounced
  // `emitted` advances, the emit effect above has already moved
  // `lastEmitted.current` forward while THIS closure's `value` is still the old
  // text — the guard would then fail and `setContent(oldText)` would revert the
  // WebView (the "typing snaps back to former text" bug). Gating on `value`
  // means we only push when the value truly changes (a real external reset);
  // `editor.setContent` targets the stable webviewRef, so a closure editor is
  // fine.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    editor.setContent(value || "");
    lastEmitted.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // ── Parse → onParse (the pills below stay in sync; unchanged behavior) ──
  const nowValue = useMemo(() => now ?? new Date(), [now]);
  const smartLoc = useMemo(() => locale ?? resolveSmartLocale(), [locale]);
  const result: SmartParseResult = useMemo(
    () =>
      parse
        ? parseSmartTodo(value, { lists, now: nowValue, locale: smartLoc })
        : { title: value, tokens: [] },
    [value, parse, lists, nowValue, smartLoc],
  );
  const onParseRef = useRef(onParse);
  onParseRef.current = onParse;
  useEffect(() => {
    if (parse) onParseRef.current?.(result);
  }, [result, parse]);

  // ── Push highlight ranges into the WebView (Phase 2) ──
  // The parser runs here; the WebView only renders. Each token → {start, end,
  // color}; the decoration plugin maps offsets to positions and paints pills.
  const smartTokens = useMemo(
    () =>
      parse
        ? result.tokens.map((t) => ({
            start: t.start,
            end: t.end,
            color: tokenColor(t, lists),
          }))
        : [],
    [result.tokens, lists, parse],
  );
  // Latest tokens for the onLoad closure (which fires once, asynchronously).
  const smartTokensRef = useRef(smartTokens);
  smartTokensRef.current = smartTokens;
  const editorReady = useRef(false);

  const pushTokens = (tokens: typeof smartTokens) => {
    // Guarded in-page: the hook may not exist for the first frame after load.
    editor.injectJS(
      `window.__setSmartTokens && window.__setSmartTokens(${JSON.stringify(tokens)});`,
    );
  };

  useEffect(() => {
    if (editorReady.current) pushTokens(smartTokens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartTokens]);

  // ── `!` / `#` trigger picker (Phase 3) ──
  // The live caret comes from the bridge state; the text is `value`. Together
  // they detect an in-progress `!…`/`#…` token and offer tappable chips.
  //
  // NOT gated on `bridgeState.isFocused`: our custom WebView bundle stubs
  // `expo-constants`, which makes tentap's `isExpo()` return true → it swaps in
  // an always-false focus shim, so `isFocused` is permanently false here. An
  // active trigger token at the caret is a tight enough condition on its own
  // (it clears the instant the token is completed, deleted, or the caret moves).
  const bridgeState = useBridgeState(editor);
  // PM position → text index (single paragraph: content starts at position 1).
  const caretIndex = Math.max(0, (bridgeState.selection?.from ?? 1) - 1);
  const trigger = parse ? detectTrigger(value, caretIndex) : null;
  const q = trigger?.query.toLowerCase() ?? "";
  const prioritySuggestions =
    trigger?.char === "!"
      ? PRIORITY_OPTIONS.filter(
          (p) => !q || p.value.startsWith(q) || p.code.startsWith(q),
        )
      : [];
  const listSuggestions =
    trigger?.char === "#"
      ? lists.filter((l) => !q || l.name.toLowerCase().includes(q)).slice(0, 6)
      : [];
  const hasSuggestions =
    prioritySuggestions.length > 0 || listSuggestions.length > 0;

  /** Replace the active `!query`/`#query` with the picked token + a space, and
   *  land the caret after it (done in the WebView via __replaceRange, since
   *  tentap's default bridge has no insert-at-caret). */
  function applySuggestion(insert: string) {
    if (!trigger) return;
    const fromPM = trigger.start + 1;
    const toPM = caretIndex + 1;
    editor.injectJS(
      `window.__replaceRange && window.__replaceRange(${fromPM}, ${toPM}, ${JSON.stringify(
        `${insert} `,
      )});`,
    );
  }

  // Ghost field — no border/background; the editor sits directly on the sheet.
  return (
    <YStack gap="$2">
      <View height={FIELD_HEIGHT} overflow="hidden">
        <RichText
          editor={editor}
          // Editor is ready here → flush the current highlight ranges.
          onLoad={() => {
            editorReady.current = true;
            pushTokens(smartTokensRef.current);
          }}
          style={{ flex: 1, backgroundColor: "transparent" }}
        />
      </View>

      {/* Trigger suggestions — tap to insert. Shown while the caret sits in an
          unfinished `!…`/`#…` token. */}
      {hasSuggestions ? (
        <XStack flexWrap="wrap" items="center" gap="$1.5">
          {prioritySuggestions.map((p) => (
            <SuggestionChip
              key={p.value}
              tint={tint(PRIORITY_COLOR[p.value])}
              icon={<Flag size={11} color={PRIORITY_COLOR[p.value]} />}
              label={p.label}
              hint={p.code.toUpperCase()}
              onPress={() => applySuggestion(`!${p.value}`)}
            />
          ))}
          {listSuggestions.map((l) => (
            <SuggestionChip
              key={l.id}
              tint={tint(l.color)}
              icon={
                l.isDefault ? (
                  <Inbox size={11} color="$mutedForeground" />
                ) : (
                  <View
                    width={8}
                    height={8}
                    rounded={9999}
                    style={{ backgroundColor: l.color || "#6b7280" }}
                  />
                )
              }
              label={l.name}
              // Insert the first word — the parser resolves it back to the full
              // list by prefix, so a multi-word name stays one token.
              onPress={() => applySuggestion(`#${l.name.split(/\s+/)[0]}`)}
            />
          ))}
        </XStack>
      ) : null}
    </YStack>
  );
});

/** Tappable insert chip for the trigger menu — same pill language as the
 *  highlights, plus a dim P-code hint for priorities. */
function SuggestionChip({
  tint: bg,
  icon,
  label,
  hint,
  onPress,
}: {
  tint: string;
  icon?: ReactNode;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <XStack
      items="center"
      gap="$1"
      px="$2"
      py="$1"
      rounded={999}
      style={{ backgroundColor: bg }}
      onPress={onPress}
      pressStyle={{ opacity: 0.7 }}
      role="button"
      aria-label={`Insert ${label}`}
    >
      {icon}
      <Text fontSize="$1" fontWeight="600" color="$color">
        {label}
      </Text>
      {hint ? (
        <Text fontSize="$1" color="$mutedForeground">
          {hint}
        </Text>
      ) : null}
    </XStack>
  );
}
