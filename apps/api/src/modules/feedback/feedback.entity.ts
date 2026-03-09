import { Entity, EntityProps, Ok, Err, Result } from '../../shared';

export interface FeedbackProps extends EntityProps {
  userId: string;
  type: 'general' | 'bug' | 'feature';
  message: string;
}

export class Feedback extends Entity<FeedbackProps> {
  private constructor(props: FeedbackProps, id?: string) { super(props, id); }

  get userId(): string { return this.get('userId'); }
  get type(): string { return this.get('type'); }
  get message(): string { return this.get('message'); }

  static create(props: Omit<FeedbackProps, 'id' | 'createdAt' | 'updatedAt'>): Result<Feedback> {
    if (!props.userId) return Err(new Error('User is required'));
    if (!props.message?.trim()) return Err(new Error('Message is required'));
    if (!['general', 'bug', 'feature'].includes(props.type)) return Err(new Error('Invalid feedback type'));
    return Ok(new Feedback(props as FeedbackProps));
  }

  static reconstitute(props: FeedbackProps, id: string): Feedback { return new Feedback(props, id); }
}
