// Bahasa Indonesia natural-language date parser.
//
// chrono-node has no Indonesian locale, so this is a focused hand-rolled parser
// for the common everyday expressions. It returns the same `ParsedDateMatch`
// shape as the chrono adapter, so `date-parse.ts` can merge it with English.
//
// Coverage (best-effort, high-frequency first): hari ini / besok / lusa /
// kemarin (± lusa) · minggu|bulan|tahun depan|lalu · weekday names (senin…) with
// optional "hari " / " depan" · tanggal N · N <bulan> · N hari|minggu lagi ·
// dalam N hari. Boundaries use `(^|\s)` + a lookahead (no lookbehind — Hermes
// safe). Ambiguity note: "minggu depan/ini/lalu" = the WEEK; bare "minggu" /
// "hari minggu" = Sunday.
import { addDays, addMonths, addYears, format, startOfDay } from "date-fns";
import type { ParsedDateMatch } from "./date-parse";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

const WEEKDAYS: Record<string, number> = {
  minggu: 0,
  ahad: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  "jum'at": 5,
  sabtu: 6,
};

const MONTHS: Record<string, number> = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  agu: 7,
  agt: 7,
  sep: 8,
  okt: 9,
  nov: 10,
  des: 11,
};

/** Soonest date on/after today (or +1 week) whose weekday is `dow`. */
function forwardWeekday(ref: Date, dow: number, nextWeek: boolean): Date {
  const delta = ((dow - ref.getDay() + 7) % 7) + (nextWeek ? 7 : 0);
  return addDays(startOfDay(ref), delta);
}

/** The `day`-th of this month, rolled to next month if already past. */
function dayOfMonth(ref: Date, day: number): Date {
  let d = startOfDay(new Date(ref.getFullYear(), ref.getMonth(), day));
  if (d < startOfDay(ref)) d = addMonths(d, 1);
  return d;
}

/** `day` of `monthIdx`, rolled to next year if already past. */
function dayInMonth(ref: Date, day: number, monthIdx: number): Date {
  let d = startOfDay(new Date(ref.getFullYear(), monthIdx, day));
  if (d < startOfDay(ref)) d = addYears(d, 1);
  return d;
}

// Each rule: a regex whose group 1 is the leading boundary (`^`/space); the
// phrase is everything after it. `resolve` gets the RegExp match + `ref`.
interface Rule {
  re: RegExp;
  resolve: (m: RegExpExecArray, ref: Date) => Date | null;
}

const B = "(^|\\s)"; // leading boundary (no lookbehind)
const END = "(?=\\s|$|[.,!?;])"; // trailing boundary (lookahead)
const MONTHS_RE = Object.keys(MONTHS).join("|");
const WEEK_RE = Object.keys(WEEKDAYS).join("|");

const RULES: Rule[] = [
  // Relative day words (longer phrases first so "kemarin lusa" wins).
  {
    re: new RegExp(`${B}(hari ini)${END}`, "gi"),
    resolve: (_m, r) => startOfDay(r),
  },
  {
    re: new RegExp(`${B}(besok|esok|besuk)${END}`, "gi"),
    resolve: (_m, r) => addDays(startOfDay(r), 1),
  },
  {
    re: new RegExp(`${B}(lusa)${END}`, "gi"),
    resolve: (_m, r) => addDays(startOfDay(r), 2),
  },
  {
    re: new RegExp(`${B}(kemarin lusa)${END}`, "gi"),
    resolve: (_m, r) => addDays(startOfDay(r), -2),
  },
  {
    re: new RegExp(`${B}(kemarin)${END}`, "gi"),
    resolve: (_m, r) => addDays(startOfDay(r), -1),
  },

  // Week / month / year, relative.
  {
    re: new RegExp(`${B}(minggu depan)${END}`, "gi"),
    resolve: (_m, r) => addDays(startOfDay(r), 7),
  },
  {
    re: new RegExp(`${B}(minggu (?:lalu|kemarin))${END}`, "gi"),
    resolve: (_m, r) => addDays(startOfDay(r), -7),
  },
  {
    re: new RegExp(`${B}(bulan depan)${END}`, "gi"),
    resolve: (_m, r) => addMonths(startOfDay(r), 1),
  },
  {
    re: new RegExp(`${B}(bulan lalu)${END}`, "gi"),
    resolve: (_m, r) => addMonths(startOfDay(r), -1),
  },
  {
    re: new RegExp(`${B}(tahun depan)${END}`, "gi"),
    resolve: (_m, r) => addYears(startOfDay(r), 1),
  },

  // "dalam N hari" / "N hari lagi" / "N minggu lagi".
  {
    re: new RegExp(`${B}dalam (\\d{1,3}) hari${END}`, "gi"),
    resolve: (m, r) => addDays(startOfDay(r), Number(m[2])),
  },
  {
    re: new RegExp(`${B}(\\d{1,3}) hari lagi${END}`, "gi"),
    resolve: (m, r) => addDays(startOfDay(r), Number(m[2])),
  },
  {
    re: new RegExp(`${B}(\\d{1,2}) minggu lagi${END}`, "gi"),
    resolve: (m, r) => addDays(startOfDay(r), Number(m[2]) * 7),
  },

  // Weekday name, optional "hari " prefix and " depan" suffix.
  {
    re: new RegExp(`${B}(?:hari )?(${WEEK_RE})( depan)?${END}`, "gi"),
    // `?? 0` / `!`-free: group 2 always matches (WEEK_RE alternation), but the
    // strict indexed-access config can't see that — fall back harmlessly.
    resolve: (m, r) =>
      forwardWeekday(r, WEEKDAYS[(m[2] ?? "").toLowerCase()] ?? 0, !!m[3]),
  },

  // "tanggal N", "N <bulan>", "<bulan> N".
  {
    re: new RegExp(`${B}tanggal (\\d{1,2})${END}`, "gi"),
    resolve: (m, r) => dayOfMonth(r, Number(m[2])),
  },
  {
    re: new RegExp(`${B}(\\d{1,2}) (${MONTHS_RE})${END}`, "gi"),
    resolve: (m, r) =>
      dayInMonth(r, Number(m[2]), MONTHS[(m[3] ?? "").toLowerCase()] ?? 0),
  },
  {
    re: new RegExp(`${B}(${MONTHS_RE}) (\\d{1,2})${END}`, "gi"),
    resolve: (m, r) =>
      dayInMonth(r, Number(m[3]), MONTHS[(m[2] ?? "").toLowerCase()] ?? 0),
  },
];

/** Parse every recognized Indonesian date phrase in `text` (overlaps are left
 *  for the caller's merge to dedupe). */
export function parseIndonesianDates(
  text: string,
  ref: Date,
): ParsedDateMatch[] {
  const out: ParsedDateMatch[] = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(text)) !== null) {
      const lead = (m[1] ?? "").length; // the (^|\s) boundary
      const start = m.index + lead;
      const end = m.index + m[0].length; // lookahead is zero-width
      const date = rule.resolve(m, ref);
      if (!date || Number.isNaN(date.getTime())) continue;
      out.push({ date: ymd(date), start, end, text: text.slice(start, end) });
      // Guard against a zero-width loop.
      if (rule.re.lastIndex === m.index) rule.re.lastIndex++;
    }
  }
  return out;
}
