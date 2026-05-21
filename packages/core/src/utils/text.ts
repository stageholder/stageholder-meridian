/**
 * Count words in an HTML string by stripping tags and splitting on whitespace.
 * Used for legacy HTML journal content (pre-JSON-storage migration).
 */
export function countWords(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length === 0) return 0;
  return text.split(" ").length;
}

/**
 * Minimal ProseMirror-shape node for word counting. Intentionally a subset
 * of `@tiptap/core`'s `JSONContent` so this utility stays a zero-dep,
 * server-safe function — works in NestJS, in Tauri, and in browsers without
 * pulling tiptap into every consumer.
 *
 * `JSONContent` from @tiptap/core is structurally compatible with this
 * shape, so callers passing a real TipTap doc don't need to cast.
 */
export interface JSONContentNode {
  type?: string;
  text?: string;
  content?: JSONContentNode[];
}

/**
 * Count words in a TipTap JSON document by walking the node tree and
 * extracting text-node values. Mirrors `countWords()` semantics — split
 * on whitespace, collapse empties — so a journal entry's wordCount stays
 * stable across the HTML → JSON migration.
 *
 * Server-safe (no DOM). Used by the API entity when computing wordCount
 * on create / update, and by the offline mutation queue when recomputing
 * cached values.
 */
export function countWordsFromJSON(doc: JSONContentNode | undefined): number {
  if (!doc) return 0;
  const text = extractText(doc).replace(/\s+/g, " ").trim();
  if (text.length === 0) return 0;
  return text.split(" ").length;
}

function extractText(node: JSONContentNode): string {
  if (typeof node.text === "string") return node.text + " ";
  if (!Array.isArray(node.content)) return "";
  let out = "";
  for (const child of node.content) out += extractText(child);
  return out;
}

/**
 * Detect whether journal content is in legacy HTML-string form or the
 * new TipTap JSON form. Used at the storage / encryption boundary during
 * the dual-format compatibility window — callers branch on the result to
 * pick the right word counter and the right renderer.
 *
 * Treats any non-string, non-null value as JSON. An empty string is
 * still HTML semantically (legacy empty state); empty JSON should be
 * represented as `{ type: "doc", content: [{ type: "paragraph" }] }`.
 */
export function isJsonContent(content: unknown): content is JSONContentNode {
  return content !== null && typeof content === "object";
}

/**
 * Unified word counter that dispatches on content format. Use this
 * at the storage layer where the format can be either string (legacy
 * HTML) or object (new JSON). Single source of truth so callers don't
 * scatter typeof checks.
 */
export function countWordsFromContent(
  content: string | JSONContentNode | null | undefined,
): number {
  if (content === null || content === undefined) return 0;
  if (typeof content === "string") return countWords(content);
  return countWordsFromJSON(content);
}
