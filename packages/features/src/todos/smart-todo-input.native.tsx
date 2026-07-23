// SmartTodoInput (NATIVE) — the React Native counterpart of the web overlay
// composer. The same `parseSmartTodo` drives THREE visible surfaces:
//
//   1. **in-field token highlighting** — recognized phrases ("tomorrow",
//      "!p1", "#work") render tinted + bold INSIDE the field, on a soft pill
//      fill, via styled nested <Text> children of the TextInput — the
//      react-native-controlled-mentions pattern the kit's own chat composer
//      uses (New-Architecture-proven). The fill is a square glyph-run
//      background (native text can't round corners — the web pill's radius
//      stays web-only) at the same 15% tint as the chips.
//   2. a **trigger suggestion row** — typing `!` or `#` (mirroring the web
//      caret menus) offers tappable priority / list chips that insert the
//      token, so the feature is discoverable without knowing the grammar;
//   3. the removable **preview-chip row** — every recognized token renders as
//      a chip with an × to strip it from the title.
//
// The field is a raw RN TextInput inside a kit-styled frame (not the kit
// `Input`): highlighting requires child <Text> segments, which the kit Input
// can't host. The frame mirrors the kit Input's outlined look (border, radius,
// focus ring) so the form reads unchanged.
//
// The public contract (props, `onParse`, `onSubmit`) is identical to the web
// file, so a host — notably the shared `TodoForm` — uses `<SmartTodoInput>`
// with no per-platform branching.
//
// Caret tracking: the trigger detector needs the caret position, which RN
// only exposes via `onSelectionChange`. Inserting a suggestion rewrites
// `value`; RN then moves the caret to the end of the update, which matches
// the type-at-the-end flow this composer is for.
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TextInput, Text as RNText } from "react-native";
import { useTheme } from "tamagui";
import { Calendar, Flag, Inbox } from "@tamagui/lucide-icons-2";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import {
  parseSmartTodo,
  type SmartParseResult,
  type SmartToken,
  type SmartTokenKind,
} from "@repo/core/todos/smart-parse";
import { resolveSmartLocale } from "@repo/core/todos/date-parse";
import type {
  SmartListOption,
  SmartTodoInputHandle,
  SmartTodoInputProps,
} from "./smart-todo-input.types";

// Native tints are plain hex-with-alpha (no CSS vars on RN). Dates use the todo
// red; priority/list use their own swatch — same language as the web pills.
const TODO_RED = "#ef4444";
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
};
function tint(hex?: string): string {
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}26` : "#8888881f";
}

// The `!` menu's options — the word form is inserted (reads better in the
// title than `!p1`), but the P-code is matched too so typing `!p2` filters.
const PRIORITY_OPTIONS = [
  { value: "urgent", code: "p1", label: "Urgent" },
  { value: "high", code: "p2", label: "High" },
  { value: "medium", code: "p3", label: "Medium" },
  { value: "low", code: "p4", label: "Low" },
] as const;

interface ActiveTrigger {
  char: "!" | "#";
  /** Index of the trigger char itself. */
  start: number;
  /** The query typed after the trigger (may be empty). */
  query: string;
}

/** Highlight color for a recognized token — same palette as the web pills. */
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

interface Segment {
  text: string;
  /** Highlight color; undefined = plain title text. */
  color?: string;
}

/** Split `value` into plain / highlighted runs from the parser's token
 *  ranges (sorted, non-overlapping — the parser guarantees both). */
function buildSegments(
  value: string,
  tokens: SmartToken[],
  lists: SmartListOption[],
): Segment[] {
  const segs: Segment[] = [];
  let cursor = 0;
  for (const t of tokens) {
    if (t.start > cursor) segs.push({ text: value.slice(cursor, t.start) });
    segs.push({
      text: value.slice(t.start, t.end),
      color: tokenColor(t, lists),
    });
    cursor = t.end;
  }
  if (cursor < value.length) segs.push({ text: value.slice(cursor) });
  return segs;
}

/** Detect an in-progress `!`/`#` trigger immediately left of the caret —
 *  same rule as the web variant (token must start the word). */
function detectTrigger(value: string, caret: number): ActiveTrigger | null {
  const upto = value.slice(0, caret);
  const m = /(^|\s)([!#])(\S*)$/.exec(upto);
  if (!m) return null;
  const char = m[2] as "!" | "#";
  const query = m[3];
  const start = caret - query.length - 1;
  return { char, start, query };
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
    onSubmit,
    placeholder,
    autoFocus,
    parse = true,
    showChips = true,
    onParse,
  },
  ref,
) {
  const inputRef = useRef<TextInput | null>(null);
  useImperativeHandle(
    ref,
    () => ({ focus: () => inputRef.current?.focus?.() }),
    [],
  );

  // Theme colors resolved to raw values — nested RNText children of a
  // TextInput take plain RN styles, not Tamagui tokens.
  const theme = useTheme();
  const baseColor = theme.color?.val ?? "#000";
  const placeholderColor =
    theme.placeholderColor?.val ?? theme.mutedForeground?.val ?? "#888";
  const [focused, setFocused] = useState(false);

  // Caret position from the underlying TextInput — drives trigger detection.
  // Structurally typed: only `selection.start` is read, and the narrow shape
  // is assignable to RN's NativeSyntheticEvent handler contract.
  const [caret, setCaret] = useState(0);
  const handleSelectionChange = (e: {
    nativeEvent: { selection: { start: number } };
  }) => {
    setCaret(e.nativeEvent.selection.start);
  };

  const result: SmartParseResult = parse
    ? parseSmartTodo(value, {
        lists,
        now: now ?? new Date(),
        locale: locale ?? resolveSmartLocale(),
      })
    : { title: value, tokens: [] };

  const onParseRef = useRef(onParse);
  onParseRef.current = onParse;
  useEffect(() => {
    if (parse) onParseRef.current?.(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, parse]);

  // ── `!` / `#` trigger menu (native mirror of the web caret menu). ──
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

  /** Replace the active trigger (`!que` / `#que`) with the picked token. */
  function applySuggestion(insert: string) {
    if (!trigger) return;
    const before = value.slice(0, trigger.start);
    const after = value.slice(caret);
    const needsSpace = after.length === 0 || !after.startsWith(" ");
    const next = before + insert + (needsSpace ? " " : "") + after;
    onValueChange(next);
    // The controlled update lands the caret at the end of the new text on RN;
    // advance our mirror so the trigger clears immediately (onSelectionChange
    // confirms a beat later).
    setCaret(next.length);
    inputRef.current?.focus?.();
  }

  function removeKind(kind: SmartTokenKind) {
    const ranges = result.tokens.filter((t) => t.kind === kind);
    if (!ranges.length) return;
    let next = value;
    for (const t of [...ranges].sort((a, b) => b.start - a.start)) {
      next = next.slice(0, t.start) + next.slice(t.end);
    }
    onValueChange(next.replace(/\s{2,}/g, " ").trim());
  }
  const labelFor = (kind: SmartTokenKind) =>
    result.tokens.find((t) => t.kind === kind)?.label ?? "";
  const activeList = lists.find((l) => l.id === result.listId);

  // In-field highlight segments — recognized tokens tint + bold inside the
  // field (kit chat-composer pattern: styled <Text> children of a TextInput).
  // Empty value → null children so the placeholder shows.
  const segments = useMemo(
    () =>
      parse && value.length > 0
        ? buildSegments(value, result.tokens, lists)
        : null,
    // result derives from value/lists/parse each render — keying on those
    // keeps the memo honest without re-deriving on identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, parse, lists, result.tokens],
  );

  return (
    <YStack gap="$2">
      {/* Kit-Input-look frame around a raw TextInput (the kit Input can't
          host the nested highlight <Text> children). */}
      <View
        height={40}
        px="$3"
        justify="center"
        rounded="$4"
        borderWidth={1}
        borderColor={focused ? "$primary" : "$borderColor"}
        bg="$background"
      >
        <TextInput
          ref={inputRef}
          onChangeText={onValueChange}
          onSelectionChange={handleSelectionChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          autoFocus={autoFocus}
          onSubmitEditing={() => onSubmit?.(result)}
          style={{
            fontSize: 16,
            color: baseColor,
            padding: 0,
            margin: 0,
            backgroundColor: "transparent",
          }}
        >
          {segments
            ? segments.map((s, i) =>
                s.color ? (
                  <RNText
                    key={i}
                    style={{
                      color: s.color,
                      fontWeight: "600",
                      // Soft pill fill behind the token — same 15% tint as the
                      // chips. RN maps this to BackgroundColorSpan (Android) /
                      // NSBackgroundColorAttributeName (iOS); it's a square
                      // glyph-run fill (no rounding possible in a native text
                      // field — the web pill's radius stays web-only). If QA
                      // shows selection/emoji artifacts on some device, delete
                      // just this backgroundColor line — color+bold carry the
                      // highlight on their own.
                      backgroundColor: tint(s.color),
                    }}
                  >
                    {s.text}
                  </RNText>
                ) : (
                  <RNText key={i} style={{ color: baseColor }}>
                    {s.text}
                  </RNText>
                ),
              )
            : parse
              ? null
              : value || null}
        </TextInput>
      </View>

      {/* Trigger suggestions — tap to insert. Shown while the caret sits in
          an unfinished `!…`/`#…` token, mirroring the web dropdown. */}
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
              // Insert the first word — the parser resolves it back to the
              // full list by prefix, so multi-word names stay one token.
              onPress={() => applySuggestion(`#${l.name.split(/\s+/)[0]}`)}
            />
          ))}
        </XStack>
      ) : null}

      {showChips && result.tokens.length > 0 ? (
        <XStack flexWrap="wrap" items="center" gap="$1.5">
          {result.doDate ? (
            <Chip
              tint={tint(TODO_RED)}
              icon={<Calendar size={11} color={TODO_RED} />}
              label={labelFor("do")}
              onRemove={() => removeKind("do")}
            />
          ) : null}
          {result.dueDate ? (
            <Chip
              tint={tint(TODO_RED)}
              icon={<Flag size={11} color={TODO_RED} />}
              label={`Deadline · ${labelFor("due")}`}
              onRemove={() => removeKind("due")}
            />
          ) : null}
          {result.priority ? (
            <Chip
              tint={tint(PRIORITY_COLOR[result.priority])}
              icon={<Flag size={11} color={PRIORITY_COLOR[result.priority]} />}
              label={labelFor("priority")}
              onRemove={() => removeKind("priority")}
            />
          ) : null}
          {result.listId ? (
            <Chip
              tint={tint(activeList?.color)}
              icon={
                activeList?.isDefault ? (
                  <Inbox size={11} color="$mutedForeground" />
                ) : (
                  <View
                    width={8}
                    height={8}
                    rounded={9999}
                    style={{ backgroundColor: activeList?.color || "#6b7280" }}
                  />
                )
              }
              label={labelFor("list")}
              onRemove={() => removeKind("list")}
            />
          ) : null}
        </XStack>
      ) : null}
    </YStack>
  );
});

/** Tappable insert chip for the trigger menu — same pill language as the
 *  preview chips, plus a dim P-code hint for priorities. */
function SuggestionChip({
  tint,
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
      style={{ backgroundColor: tint }}
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

function Chip({
  tint,
  icon,
  label,
  onRemove,
}: {
  tint: string;
  icon?: ReactNode;
  label: string;
  onRemove: () => void;
}) {
  return (
    <XStack
      items="center"
      gap="$1"
      pl="$2"
      pr="$1.5"
      py="$0.5"
      rounded={999}
      style={{ backgroundColor: tint }}
    >
      {icon}
      <Text fontSize="$1" fontWeight="600" color="$color">
        {label}
      </Text>
      <Text
        color="$mutedForeground"
        fontSize="$2"
        lineHeight={0}
        onPress={onRemove}
        aria-label={`Remove ${label}`}
      >
        ×
      </Text>
    </XStack>
  );
}
