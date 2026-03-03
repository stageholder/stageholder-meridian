import { Entity, EntityProps, Ok, Err, Result } from '../../shared';

export type TodoStatus = 'todo' | 'in_progress' | 'done';
export type TodoPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export interface TodoProps extends EntityProps {
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate?: string;
  listId: string;
  workspaceId: string;
  assigneeId?: string;
  creatorId: string;
  order: number;
}

export class Todo extends Entity<TodoProps> {
  private constructor(props: TodoProps, id?: string) { super(props, id); }

  get title(): string { return this.get('title'); }
  get description(): string | undefined { return this.get('description'); }
  get status(): TodoStatus { return this.get('status'); }
  get priority(): TodoPriority { return this.get('priority'); }
  get dueDate(): string | undefined { return this.get('dueDate'); }
  get listId(): string { return this.get('listId'); }
  get workspaceId(): string { return this.get('workspaceId'); }
  get assigneeId(): string | undefined { return this.get('assigneeId'); }
  get creatorId(): string { return this.get('creatorId'); }
  get order(): number { return this.get('order'); }

  updateTitle(title: string): void { this.set('title', title); }
  updateDescription(description: string | undefined): void { this.set('description', description); }
  updateStatus(status: TodoStatus): void { this.set('status', status); }
  updatePriority(priority: TodoPriority): void { this.set('priority', priority); }
  updateDueDate(dueDate: string | undefined): void { this.set('dueDate', dueDate); }
  updateAssigneeId(assigneeId: string | undefined): void { this.set('assigneeId', assigneeId); }
  updateOrder(order: number): void { this.set('order', order); }

  static create(props: Omit<TodoProps, 'id' | 'createdAt' | 'updatedAt'>): Result<Todo> {
    if (!props.title || props.title.trim().length === 0) return Err(new Error('Todo title is required'));
    if (!props.listId) return Err(new Error('List is required'));
    if (!props.workspaceId) return Err(new Error('Workspace is required'));
    if (!props.creatorId) return Err(new Error('Creator is required'));
    return Ok(new Todo({ ...props, status: props.status || 'todo', priority: props.priority || 'none', order: props.order ?? 0 } as TodoProps));
  }

  static reconstitute(props: TodoProps, id: string): Todo { return new Todo(props, id); }
}
