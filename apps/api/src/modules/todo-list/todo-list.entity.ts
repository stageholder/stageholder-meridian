import { Entity, EntityProps, Ok, Err, Result } from '../../shared';

export interface TodoListProps extends EntityProps {
  name: string;
  color?: string;
  icon?: string;
  workspaceId: string;
  isShared: boolean;
  isDefault: boolean;
  creatorId: string;
}

export class TodoList extends Entity<TodoListProps> {
  private constructor(props: TodoListProps, id?: string) { super(props, id); }

  get name(): string { return this.get('name'); }
  get color(): string | undefined { return this.get('color'); }
  get icon(): string | undefined { return this.get('icon'); }
  get workspaceId(): string { return this.get('workspaceId'); }
  get isShared(): boolean { return this.get('isShared'); }
  get isDefault(): boolean { return this.get('isDefault'); }
  get creatorId(): string { return this.get('creatorId'); }

  updateName(name: string): void { this.set('name', name); }
  updateColor(color: string | undefined): void { this.set('color', color); }
  updateIcon(icon: string | undefined): void { this.set('icon', icon); }
  updateIsShared(isShared: boolean): void { this.set('isShared', isShared); }

  static create(props: Omit<TodoListProps, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'> & { isDefault?: boolean }): Result<TodoList> {
    if (!props.name || props.name.trim().length === 0) return Err(new Error('Todo list name is required'));
    if (!props.workspaceId) return Err(new Error('Workspace is required'));
    if (!props.creatorId) return Err(new Error('Creator is required'));
    return Ok(new TodoList({ ...props, isShared: props.isShared ?? false, isDefault: props.isDefault ?? false } as TodoListProps));
  }

  static reconstitute(props: TodoListProps, id: string): TodoList { return new TodoList(props, id); }
}
