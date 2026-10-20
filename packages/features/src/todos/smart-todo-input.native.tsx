// SmartTodoInput (NATIVE) — a plain React Native TextInput.
//
// HISTORY: this field was a 10tap/tentap WebView editor (TipTap in a WKWebView)
// so recognized phrases could be painted as ROUNDED inline pills (RN cannot
// round the background of an inline text run — react-native#10807). That bought
// the rounded corners at the price of everything else in the composer's feel:
//   - a ~900 KB web bundle booted on every first open (stand-in → WebView swap
//     = a visible blink, 1–2 s before the field was live),
//   - and, decisively, NO KEYBOARD on programmatic focus: WKWebView only raises
//     the keyboard for a user gesture; react-native-webview's workaround
//     (`keyboardDisplayRequiresUserAction=false`) swizzles private WebKit
//     selectors from iOS 13–17 that iOS 26 no longer uses, so `focus()` placed
//     the caret and the keyboard never came (measured on the iOS 26.5
//     simulator, 2026-10-20). Warming the WebView did not change that.
// A native TextInput has none of those problems: it mounts in the sheet's open
// commit for free, `focus()` raises the keyboard at once, and nothing blinks.
// The highlight is now a SQUARE coloured run (nested <Text> with a background,
// which RN does support) instead of a rounded pill — the pills row below the
// field still shows every parsed value with the full treatment.
//
// The public contract (props, `onParse`, `onSubmit`, ref `focus`/`blur`) is
// identical to the web sibling, so the host `QuickAddTodoSheet` is unchanged
// in shape. The web file (`smart-todo-input.tsx`) is untouched.
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Text as RNText,
  TextInput,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from "react-native";
import { useTheme } from "tamagui";
import { Flag } from "@tamagui/lucide-icons-2/icons/Flag";
import { Inbox } from "@tamagui/lucide-icons-2/icons/Inbox";
import { Text, View, XStack, YStack } from "@stageholder/ui";
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

// Todo-red caret, matching the web composer.
const TODO_RED = "#ef4444";
// Highlight fill per token kind (same language as the web pills / native chips).
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};

function tokenColor(token: SmartToken, lists: SmartListOption[]): string {
  switch (token.kind) {
    case "priority":
      return PRIORITY_COLOR[token.value] ?? TODO_RED;
    case "list":
      return lists.find((l) => l.id === token.value)?.color || "#6b7280";
    default:
      return TODO_RED;
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

// One line tall by default (the WebView field was a fixed two-line 64 px box,
// which read as dead air in the compact composer); the multiline input grows
// with the text and the `fit`-sized host sheet re-measures with it.
const FIELD_MIN_HEIGHT = 44;
const FONT_SIZE = 16;
const LINE_HEIGHT = 22;

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
    onSubmit,
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

  const inputRef = useRef<TextInput>(null);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
    }),
    [],
  );

  // ── Parse → onParse (the pills below stay in sync) ──
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

  // ── Inline highlight: the value as nested <Text> runs inside the TextInput ──
  // RN paints a nested run's `backgroundColor` (square — no radius on inline
  // text, react-native#10807). Rendered as CHILDREN (not `value`) so the runs
  // carry style; the string the user sees is byte-identical to `value`, which
  // is what keeps the caret in place across re-renders.
  const runs = useMemo(() => {
    if (!parse || result.tokens.length === 0) return null;
    const out: ReactNode[] = [];
    let cursor = 0;
    result.tokens.forEach((t, i) => {
      if (t.start > cursor) out.push(value.slice(cursor, t.start));
      out.push(
        <RNText
          key={`${t.kind}-${t.start}-${i}`}
          style={{ backgroundColor: tokenColor(t, lists), color: "#ffffff" }}
        >
          {value.slice(t.start, t.end)}
        </RNText>,
      );
      cursor = t.end;
    });
    if (cursor < value.length) out.push(value.slice(cursor));
    return out;
  }, [parse, result.tokens, value, lists]);

  // ── `!` / `#` trigger picker ──
  // The live caret comes from onSelectionChange; the text is `value`. Together
  // they detect an in-progress `!…`/`#…` token and offer tappable chips.
  const [caret, setCaret] = useState(0);
  // One-shot controlled selection, used only to land the caret after an
  // inserted suggestion; cleared on the next native selection event so the
  // field is otherwise uncontrolled (cheapest for RN's selection handling).
  const [selection, setSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);
  const onSelectionChange = (
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    setCaret(e.nativeEvent.selection.start);
    if (selection) setSelection(undefined);
  };

  const trigger = parse ? detectTrigger(value, caret) : null;
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
   *  land the caret right after it. */
  function applySuggestion(insert: string) {
    if (!trigger) return;
    const inserted = `${insert} `;
    const next = value.slice(0, trigger.start) + inserted + value.slice(caret);
    const pos = trigger.start + inserted.length;
    onValueChange(next);
    setCaret(pos);
    setSelection({ start: pos, end: pos });
    inputRef.current?.focus();
  }

  // Ghost field — no border/background; the input sits directly on the sheet.
  return (
    <YStack gap="$2">
      <View minHeight={FIELD_MIN_HEIGHT}>
        <TextInput
          ref={inputRef}
          // `value` drives the plain field; the highlighted field passes the
          // same string as styled children instead (never both).
          {...(runs ? {} : { value })}
          onChangeText={(t) => onValueChange(t.replace(/\n+/g, " "))}
          onSelectionChange={onSelectionChange}
          {...(selection ? { selection } : {})}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          multiline
          // Return = submit (no newline inserted) — the composer's Enter.
          submitBehavior="submit"
          onSubmitEditing={() => onSubmit?.(result)}
          autoFocus={!!autoFocus}
          autoCapitalize="sentences"
          autoCorrect
          selectionColor={TODO_RED}
          cursorColor={TODO_RED}
          scrollEnabled={false}
          style={{
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 12,
            fontSize: FONT_SIZE,
            lineHeight: LINE_HEIGHT,
            color: fg,
            textAlignVertical: "top",
          }}
        >
          {runs}
        </TextInput>
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
