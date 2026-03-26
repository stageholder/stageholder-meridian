import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

function countWords(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length === 0) return 0;
  return text.split(" ").length;
}

export interface JournalProps extends EntityProps {
  title: string;
  content: string;
  mood?: number;
  tags: string[] | string;
  workspaceId: string;
  authorId: string;
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
  get content(): string {
    return this.get("content");
  }
  get mood(): number | undefined {
    return this.get("mood");
  }
  get tags(): string[] | string {
    return this.get("tags");
  }
  get workspaceId(): string {
    return this.get("workspaceId");
  }
  get authorId(): string {
    return this.get("authorId");
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
  updateContent(content: string): void {
    this.set("content", content);
    if (!this.encrypted) {
      this.set("wordCount", countWords(content));
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
    if (!props.workspaceId) return Err(new Error("Workspace is required"));
    if (!props.authorId) return Err(new Error("Author is required"));
    if (!props.date) return Err(new Error("Date is required"));
    if (props.mood !== undefined && (props.mood < 1 || props.mood > 5))
      return Err(new Error("Mood must be between 1 and 5"));
    return Ok(
      new Journal({
        ...props,
        tags: props.tags || [],
        wordCount:
          props.wordCount ??
          (isEncrypted ? 0 : countWords(props.content || "")),
        encrypted: isEncrypted,
      } as JournalProps),
    );
  }

  static reconstitute(props: JournalProps, id: string): Journal {
    return new Journal(props, id);
  }
}
