// Natural-language date adapter — owns all date-parsing i18n.
//
// Multi-language: chrono-node's MAIN entry exposes a parser namespace per
// language (`chrono.en`, `chrono.fr`, …). We ALWAYS run English plus the user's
// detected language and merge the matches, so both "tomorrow" and "demain"
// resolve for a French user (chrono parsers are language-specific — there's no
// detect-the-text, so running both is what makes it robust).
//
// Indonesian ("id") has NO chrono locale, so it's a hand-rolled parser
// (`indonesian-date.ts`) merged in the same way. Adding another chrono locale
// later = one line in `CHRONO_LOCALES` + the `SmartLocale` union.
import * as chrono from "chrono-node";
import { format } from "date-fns";
import { parseIndonesianDates } from "./indonesian-date";

export type SmartLocale = "en" | "fr" | "ja" | "nl" | "ru" | "uk" | "id";

export const SUPPORTED_SMART_LOCALES: readonly SmartLocale[] = [
  "en",
  "fr",
  "ja",
  "nl",
  "ru",
  "uk",
  "id",
];

// The subset backed by a chrono locale (everything except the custom "id").
type ChronoLocale = Exclude<SmartLocale, "id">;
const CHRONO_LOCALES: Record<ChronoLocale, typeof chrono.en> = {
  en: chrono.en,
  fr: chrono.fr,
  ja: chrono.ja,
  nl: chrono.nl,
  ru: chrono.ru,
  uk: chrono.uk,
};

/** localStorage key for an explicit override (web) — the app has no language
 *  setting yet, so this is the manual escape hatch. Set it and reload:
 *  `localStorage.setItem("meridian.smartLocale", "id")`. */
export const SMART_LOCALE_STORAGE_KEY = "meridian.smartLocale";

/**
 * Resolve the smart-input language, in priority order:
 *   1. an explicit `pref` argument,
 *   2. a stored override (web `localStorage`),
 *   3. the user's ordered browser languages (web `navigator.languages`),
 *   4. the resolved `Intl` locale (also the native path).
 * The first supported NON-English match wins; otherwise English. English always
 * parses too, so this only decides which SECOND language to enable. Every source
 * is guarded, so it's safe on web + Hermes.
 */
export function resolveSmartLocale(pref?: string): SmartLocale {
  const candidates: string[] = [];
  if (pref) candidates.push(pref);
  try {
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(SMART_LOCALE_STORAGE_KEY)
        : null;
    if (stored) candidates.push(stored);
  } catch {
    /* localStorage blocked — ignore */
  }
  try {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav?.languages?.length) candidates.push(...nav.languages);
    else if (nav?.language) candidates.push(nav.language);
  } catch {
    /* no navigator (native/SSR) — ignore */
  }
  try {
    candidates.push(new Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    /* no Intl — ignore */
  }

  for (const tag of candidates) {
    const lang = (tag || "").toLowerCase().split(/[-_]/)[0];
    if (
      lang !== "en" &&
      (SUPPORTED_SMART_LOCALES as readonly string[]).includes(lang)
    ) {
      return lang as SmartLocale;
    }
  }
  return "en";
}

export interface ParsedDateMatch {
  /** Resolved calendar day as `yyyy-MM-dd` in LOCAL time. */
  date: string;
  /** Start index of the matched phrase in the source text (inclusive). */
  start: number;
  /** End index of the matched phrase in the source text (exclusive). */
  end: number;
  /** The exact source substring that matched. */
  text: string;
}

function chronoMatches(
  parser: typeof chrono.en,
  text: string,
  ref: Date,
): ParsedDateMatch[] {
  return parser.parse(text, ref, { forwardDate: true }).map((r) => ({
    date: format(r.start.date(), "yyyy-MM-dd"),
    start: r.index,
    end: r.index + r.text.length,
    text: r.text,
  }));
}

/**
 * Extract every natural-language date phrase, parsing with English AND `locale`
 * (deduped by overlap, earliest-then-longest wins). Time-of-day is discarded —
 * Meridian todos are date-only.
 */
export function parseDates(
  text: string,
  ref: Date,
  locale: SmartLocale = "en",
): ParsedDateMatch[] {
  const all: ParsedDateMatch[] = [
    ...chronoMatches(CHRONO_LOCALES.en, text, ref),
  ];

  if (locale === "id") {
    all.push(...parseIndonesianDates(text, ref));
  } else if (locale !== "en") {
    all.push(...chronoMatches(CHRONO_LOCALES[locale], text, ref));
  }

  // Earliest first; on a tie prefer the longer match, then drop overlaps so the
  // English and localized parsers don't double-count the same phrase.
  all.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const out: ParsedDateMatch[] = [];
  for (const m of all) {
    if (out.some((o) => m.start < o.end && o.start < m.end)) continue;
    out.push(m);
  }
  return out;
}
