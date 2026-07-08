import { resolveIcon, type MediaValue } from "@stageholder/ui";

// The habit/group `icon` field is a plain string end-to-end (core type → Mongo
// String prop → DTO → PWA + mobile). The kit's identity primitives, however,
// speak `MediaValue` (a typed emoji|icon|image union) so a single `MediaGlyph`
// can render an emoji, a lucide icon, OR an image, and `MediaPicker` can offer
// all three. These two helpers bridge the two: they encode a picked MediaValue
// into that existing string column and parse it back — so we adopt the kit
// system with NO schema change and NO data migration.
//
// Encoding (compact, self-describing, legacy-tolerant):
//   emoji → the bare unicode char       e.g. "🌅"      (identical to old data)
//   icon  → "lucide:<name>"             e.g. "lucide:sunrise"
//   image → "img:<url>"                 (not offered for icons today; kept so a
//                                         value round-trips if ever introduced)
// A legacy value with no prefix is a bare emoji — exactly what the previous
// EmojiPicker-only flow stored — so existing groups/habits keep rendering.

const ICON_PREFIX = "lucide:";
const IMAGE_PREFIX = "img:";

/** Encode a picked MediaValue into the string persisted in `icon` (or clear). */
export function encodeMediaIcon(
  value: MediaValue | null | undefined,
): string | undefined {
  if (!value) return undefined;
  if (value.type === "emoji") return value.emoji || undefined;
  if (value.type === "icon") return `${ICON_PREFIX}${value.name}`;
  if (value.type === "image") return `${IMAGE_PREFIX}${value.url}`;
  return undefined;
}

/** Parse a persisted `icon` string into a MediaValue for `MediaGlyph`. */
export function parseMediaIcon(
  raw: string | null | undefined,
): MediaValue | null {
  if (!raw) return null;
  if (raw.startsWith(ICON_PREFIX)) {
    const name = raw.slice(ICON_PREFIX.length);
    return name ? { type: "icon", name } : null;
  }
  if (raw.startsWith(IMAGE_PREFIX)) {
    const url = raw.slice(IMAGE_PREFIX.length);
    return url ? { type: "image", url } : null;
  }
  if (/^https?:\/\//.test(raw)) return { type: "image", url: raw };
  // No prefix + not a URL. Legacy data (and any un-prefixed value) can be a bare
  // lucide key like "heart"/"target" — an ASCII identifier that resolves in the
  // icon registry → treat as an icon. Emoji are non-ASCII, so they never match
  // and fall through. Arbitrary ASCII text that isn't a real icon also falls
  // through to emoji (harmless; MediaGlyph renders it, or the site's fallback).
  if (/^[a-z][a-z0-9-]*$/i.test(raw) && resolveIcon(raw)) {
    return { type: "icon", name: raw };
  }
  return { type: "emoji", emoji: raw };
}
