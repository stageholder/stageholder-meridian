import { Entity, EntityProps, Ok, Err, Result } from '../../shared';

export interface HabitEntryProps extends EntityProps {
  habitId: string;
  date: string;
  value: number;
  type?: 'completion' | 'skip';
  skipReason?: string;
  notes?: string;
  workspaceId: string;
}

export class HabitEntry extends Entity<HabitEntryProps> {
  private constructor(props: HabitEntryProps, id?: string) { super(props, id); }

  get habitId(): string { return this.get('habitId'); }
  get date(): string { return this.get('date'); }
  get value(): number { return this.get('value'); }
  get type(): 'completion' | 'skip' { return this.get('type') || 'completion'; }
  get skipReason(): string | undefined { return this.get('skipReason'); }
  get notes(): string | undefined { return this.get('notes'); }
  get workspaceId(): string { return this.get('workspaceId'); }

  updateValue(value: number): void { this.set('value', value); }
  updateNotes(notes: string | undefined): void { this.set('notes', notes); }

  static create(props: Omit<HabitEntryProps, 'id' | 'createdAt' | 'updatedAt'>): Result<HabitEntry> {
    if (!props.habitId) return Err(new Error('Habit is required'));
    if (!props.date) return Err(new Error('Date is required'));
    if (props.value === undefined || props.value === null) return Err(new Error('Value is required'));
    if (!props.workspaceId) return Err(new Error('Workspace is required'));
    if (props.type === 'skip') props.value = 0;
    return Ok(new HabitEntry(props as HabitEntryProps));
  }

  static reconstitute(props: HabitEntryProps, id: string): HabitEntry { return new HabitEntry(props, id); }
}
