// Todoist-style "smart quick-add" parser — PURE and framework-agnostic.
//
// Turns a free-text line ("Buy milk tomorrow !p1 #groceries") into structured
// todo fields PLUS the character ranges of every recognized phrase, so a web
// composer can highlight them in place and a mobile composer can preview them as
// chips. Both platforms share this one function, so parsing can never drift.
//
// Grammar (English v1; see `date-parse.ts` for the locale-swap seam):
//   • bare date phrase           → DO-date        ("tomorrow", "next fri", "Jun 12")
//   • "by|due|deadline <date>"   → DUE-date       ("report by friday")
//   • !p1..!p4 / !urgent…!low    → priority        (Todoist mapping)
//   • #word                      → list           (fuzzy-matched to a list name)
// Anything not recognized stays in the title. The parser NEVER throws — bad
// input yields an empty token set and the whole line as the title.
import {
  format,
  differenceInCalendarDays,
  isSameYear,
  parseISO,
} from "date-fns";
import { parseDates, type SmartLocale } from "./date-parse";

export type SmartPriority = "urgent" | "high" | "medium" | "low";

export type SmartTokenKind = "do" | "due" | "priority" | "list";

export interface SmartToken {
  kind: SmartTokenKind;
  /** Start index in the source text (inclusive). */
  start: number;
  /** End index in the source text (exclusive). */
  end: number;
  /** Exact source substring covered by the token. */
  raw: string;
  /** Short human label for the pill/chip, e.g. "Tomorrow", "P1", "Groceries". */
  label: string;
  /** Canonical value: `yyyy-MM-dd` (dates), a `SmartPriority`, or a list id. */
  value: string;
}

export interface SmartParseResult {
  /** The line with every recognized token removed and whitespace tidied. */
  title: string;
  doDate?: string;
  dueDate?: string;
  priority?: SmartPriority;
  listId?: string;
  /** Every recognized token, sorted by `start` (for highlighting). */
  tokens: SmartToken[];
}

export interface SmartListRef {
  id: string;
  name: string;
}

export interface SmartParseContext {
  /** Lists a `#name` can resolve to. */
  lists: SmartListRef[];
  /** "Now" reference for relative dates (injected so the parser stays pure). */
  now: Date;
  /** Language for date + due-keyword parsing (English is always active too).
   *  Defaults to English. */
  locale?: SmartLocale;
}

// !p1..!p4 follow Todoist's mapping; the word forms are self-describing.
const PRIORITY_RE = /!(p[1-4]|urgent|high|medium|low)\b/gi;
const PRIORITY_FROM_P: Record<string, SmartPriority> = {
  p1: "urgent",
  p2: "high",
  p3: "medium",
  p4: "low",
};
// #word — a run with no whitespace and no other trigger char.
const LIST_RE = /#([^\s!#]+)/g;

// Words that, when they IMMEDIATELY precede a date, make it a DUE date (English
// is always merged in). Pre-positional languages only ("by friday" / "avant
// vendredi" / "до пятниці"); postpositional ones (ja "…まで") are left blank, so
// a bare date is a do-date and the deadline is set via the GUI chip instead.
const DUE_KEYWORDS: Record<SmartLocale, string[]> = {
  en: ["by", "due", "deadline"],
  fr: ["avant", "pour", "échéance"],
  ja: [],
  nl: ["voor", "deadline"],
  ru: ["до", "дедлайн"],
  uk: ["до", "дедлайн"],
  id: ["sebelum", "deadline", "batas"],
};

function priorityLabel(p: SmartPriority): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** Resolve a typed `#name` fragment to a list: exact → prefix → contains. */
function resolveList(
  fragment: string,
  lists: SmartListRef[],
): SmartListRef | undefined {
  const q = fragment.toLowerCase();
  return (
    lists.find((l) => l.name.toLowerCase() === q) ??
    lists.find((l) => l.name.toLowerCase().startsWith(q)) ??
    lists.find((l) => l.name.toLowerCase().includes(q))
  );
}

/** Short, friendly label for a resolved `yyyy-MM-dd` relative to `now`. */
function friendlyDateLabel(ymd: string, now: Date): string {
  const d = parseISO(ymd);
  const diff = differenceInCalendarDays(d, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return format(d, "EEEE"); // Monday…Sunday
  return isSameYear(d, now) ? format(d, "MMM d") : format(d, "MMM d, yyyy");
}

interface Range {
  start: number;
  end: number;
}

function overlaps(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Parse a smart quick-add line. Deterministic and side-effect-free — the only
 * external input is `ctx.now`, injected for testability.
 */
export function parseSmartTodo(
  text: string,
  ctx: SmartParseContext,
): SmartParseResult {
  const tokens: SmartToken[] = [];
  const claimed: Range[] = [];

  // 1) Priority — first `!pN`/`!word` wins.
  let priority: SmartPriority | undefined;
  for (const m of text.matchAll(PRIORITY_RE)) {
    const raw = (m[1] ?? "").toLowerCase();
    const value = (PRIORITY_FROM_P[raw] ?? raw) as SmartPriority;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (!priority) {
      priority = value;
      tokens.push({
        kind: "priority",
        start,
        end,
        raw: m[0],
        // Always the semantic name (Urgent/High/Medium/Low) — the app standard —
        // whether typed as `!p2` or `!high`, so every surface reads the same.
        label: priorityLabel(value),
        value,
      });
      claimed.push({ start, end });
    }
  }

  // 2) List — first `#fragment` that resolves to a list wins.
  let listId: string | undefined;
  for (const m of text.matchAll(LIST_RE)) {
    if (listId) break;
    const fragment = m[1] ?? "";
    const list = resolveList(fragment, ctx.lists);
    if (!list) continue;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    listId = list.id;
    tokens.push({
      kind: "list",
      start,
      end,
      raw: m[0],
      label: list.name,
      value: list.id,
    });
    claimed.push({ start, end });
  }

  // 3) Dates — free text; skip any match overlapping a priority/list token.
  //    A "by|due|deadline" keyword just before the phrase makes it a DUE date
  //    (and the keyword is folded into the token so "by friday" reads as one).
  const locale: SmartLocale = ctx.locale ?? "en";
  const dueKeywords = new Set(
    [...DUE_KEYWORDS.en, ...(DUE_KEYWORDS[locale] ?? [])].map((k) =>
      k.toLowerCase(),
    ),
  );

  let doDate: string | undefined;
  let dueDate: string | undefined;
  for (const dm of parseDates(text, ctx.now, locale)) {
    const range: Range = { start: dm.start, end: dm.end };
    if (claimed.some((c) => overlaps(c, range))) continue;

    // A due keyword is the word immediately before the date ("by friday").
    // Script-agnostic (no `\b`, which breaks on accents/Cyrillic): take the last
    // whitespace-delimited word before the phrase and test the keyword set.
    const trimmedBefore = text.slice(0, dm.start).replace(/\s+$/, "");
    const lastWord = /(\S+)$/.exec(trimmedBefore)?.[1] ?? "";
    const isDue = dueKeywords.has(lastWord.toLowerCase());
    if (isDue && dueDate) continue;
    if (!isDue && doDate) continue;

    // Fold the keyword into the token so "by friday" highlights as one.
    const start = isDue ? trimmedBefore.length - lastWord.length : dm.start;
    const token: SmartToken = {
      kind: isDue ? "due" : "do",
      start,
      end: dm.end,
      raw: text.slice(start, dm.end),
      label: friendlyDateLabel(dm.date, ctx.now),
      value: dm.date,
    };
    if (isDue) dueDate = dm.date;
    else doDate = dm.date;
    tokens.push(token);
    claimed.push({ start, end: dm.end });
  }

  tokens.sort((a, b) => a.start - b.start);

  // 4) Title — strip every claimed range, then collapse the gaps.
  const title = stripRanges(text, claimed)
    .replace(/\s{2,}/g, " ")
    .trim();

  // If stripping the tokens leaves NOTHING behind, the user typed a bare token
  // line — "Tomorrow", "!p1", "#work" — with no residual name. That's almost
  // certainly meant as the LITERAL title (a todo called "Tomorrow"), not a
  // field-only entry that would strip down to an untitled todo (empty title →
  // the create form no-ops). So keep the whole line as the title and drop the
  // smart interpretation entirely, so every surface agrees: no highlight, no
  // chips, no lifted date/priority — just the plain title. The moment there's
  // any other word ("Tomorrow meeting"), normal parsing resumes.
  if (!title && tokens.length > 0) {
    return {
      title: text.trim(),
      doDate: undefined,
      dueDate: undefined,
      priority: undefined,
      listId: undefined,
      tokens: [],
    };
  }

  return { title, doDate, dueDate, priority, listId, tokens };
}

/** Remove `ranges` from `text` (ranges may be unsorted / adjacent). */
function stripRanges(text: string, ranges: Range[]): string {
  if (!ranges.length) return text;
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const r of sorted) {
    if (r.start > cursor) out += text.slice(cursor, r.start);
    cursor = Math.max(cursor, r.end);
  }
  out += text.slice(cursor);
  return out;
}
