import { Entity, EntityProps, Ok, Err, Result } from '../../shared';

export interface JournalProps extends EntityProps {
  title: string;
  content: string;
  mood?: number;
  tags: string[];
  workspaceId: string;
  authorId: string;
  date: string;
}

export class Journal extends Entity<JournalProps> {
  private constructor(props: JournalProps, id?: string) { super(props, id); }

  get title(): string { return this.get('title'); }
  get content(): string { return this.get('content'); }
  get mood(): number | undefined { return this.get('mood'); }
  get tags(): string[] { return this.get('tags'); }
  get workspaceId(): string { return this.get('workspaceId'); }
  get authorId(): string { return this.get('authorId'); }
  get date(): string { return this.get('date'); }

  updateTitle(title: string): void { this.set('title', title); }
  updateContent(content: string): void { this.set('content', content); }
  updateMood(mood: number | undefined): void { this.set('mood', mood); }
  updateTags(tags: string[]): void { this.set('tags', tags); }
  updateDate(date: string): void { this.set('date', date); }

  static create(props: Omit<JournalProps, 'id' | 'createdAt' | 'updatedAt'>): Result<Journal> {
    if (!props.title || props.title.trim().length === 0) return Err(new Error('Journal title is required'));
    if (!props.workspaceId) return Err(new Error('Workspace is required'));
    if (!props.authorId) return Err(new Error('Author is required'));
    if (!props.date) return Err(new Error('Date is required'));
    if (props.mood !== undefined && (props.mood < 1 || props.mood > 5)) return Err(new Error('Mood must be between 1 and 5'));
    return Ok(new Journal({ ...props, tags: props.tags || [] } as JournalProps));
  }

  static reconstitute(props: JournalProps, id: string): Journal { return new Journal(props, id); }
}
