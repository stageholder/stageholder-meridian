import { countWordsFromContent } from "@repo/core/utils/text";
import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

/**
 * Content storage type during the Phase 2 HTML → JSON migration.
 *
 * - `string`  = legacy HTML (pre-migration journals, still in the DB)
 * - `object`  = TipTap JSON (post-migration; canonical going forward)
 *
 * The dual support is intentional. Lazy backfill means rows stay in HTML
 * format until the user opens + saves an entry, at which point the client
 * sends JSON. New entries always come in as JSON. Encrypted content stays
 * opaque on the server — the client handles HTML ↔ JSON discrimination
 * after decrypt.
 *
 * Both formats round-trip through the unified `countWordsFromContent`
 * helper so wordCount stays consistent across formats.
 */
export type JournalContent = string | Record<string, unknown>;

export interface JournalProps extends EntityProps {
  title: string;
  content: JournalContent;
  mood?: number;
  tags: string[] | string;
  userSub: string;
  date: string;
  wordCount: number;
  encrypted?: boolean;
}

export class Journal extends Entity<JournalProps> {
  private constructor(props: JournalProps, id?: string) {
    super(props, id);
  }

  get title(): string {
    return this.get("title");
  }
  get content(): JournalContent {
    return this.get("content");
  }
  get mood(): number | undefined {
    return this.get("mood");
  }
  get tags(): string[] | string {
    return this.get("tags");
  }
  get userSub(): string {
    return this.get("userSub");
  }
  get date(): string {
    return this.get("date");
  }
  get wordCount(): number {
    return this.get("wordCount");
  }
  get encrypted(): boolean {
    return this.get("encrypted") ?? false;
  }

  updateTitle(title: string): void {
    this.set("title", title);
  }
  updateContent(content: JournalContent): void {
    this.set("content", content);
    if (!this.encrypted) {
      // Dispatch by content shape: legacy HTML strings → strip tags;
      // new TipTap JSON → walk the tree. Encrypted content's wordCount
      // is provided by the client (we can't count opaque ciphertext).
      this.set("wordCount", countWordsFromContent(content));
    }
  }
  updateWordCount(wordCount: number): void {
    this.set("wordCount", wordCount);
  }
  updateMood(mood: number | undefined): void {
    this.set("mood", mood);
  }
  updateTags(tags: string[] | string): void {
    this.set("tags", tags);
  }
  updateDate(date: string): void {
    this.set("date", date);
  }

  static create(
    props: Omit<
      JournalProps,
      "id" | "createdAt" | "updatedAt" | "wordCount"
    > & {
      wordCount?: number;
    },
  ): Result<Journal> {
    const isEncrypted = props.encrypted ?? false;
    if (!isEncrypted) {
      if (!props.title || props.title.trim().length === 0)
        return Err(new Error("Journal title is required"));
    } else {
      if (!props.title) return Err(new Error("Journal title is required"));
    }
    if (!props.userSub) return Err(new Error("User is required"));
    if (!props.date) return Err(new Error("Date is required"));
    if (props.mood !== undefined && (props.mood < 1 || props.mood > 5))
      return Err(new Error("Mood must be between 1 and 5"));
    return Ok(
      new Journal({
        ...props,
        tags: props.tags || [],
        wordCount:
          props.wordCount ??
          (isEncrypted ? 0 : countWordsFromContent(props.content || "")),
        encrypted: isEncrypted,
      } as JournalProps),
    );
  }

  static reconstitute(props: JournalProps, id: string): Journal {
    return new Journal(props, id);
  }
}
