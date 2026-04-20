import { Entity, EntityProps, Ok, Err, Result } from "../../shared";

export interface TodoListProps extends EntityProps {
  name: string;
  color?: string;
  icon?: string;
  userSub: string;
  isDefault: boolean;
}

export class TodoList extends Entity<TodoListProps> {
  private constructor(props: TodoListProps, id?: string) {
    super(props, id);
  }

  get name(): string {
    return this.get("name");
  }
  get color(): string | undefined {
    return this.get("color");
  }
  get icon(): string | undefined {
    return this.get("icon");
  }
  get userSub(): string {
    return this.get("userSub");
  }
  get isDefault(): boolean {
    return this.get("isDefault");
  }

  updateName(name: string): void {
    this.set("name", name);
  }
  updateColor(color: string | undefined): void {
    this.set("color", color);
  }
  updateIcon(icon: string | undefined): void {
    this.set("icon", icon);
  }

  static create(
    props: Omit<
      TodoListProps,
      "id" | "createdAt" | "updatedAt" | "isDefault"
    > & {
      isDefault?: boolean;
    },
  ): Result<TodoList> {
    if (!props.name || props.name.trim().length === 0)
      return Err(new Error("Todo list name is required"));
    if (!props.userSub) return Err(new Error("User is required"));
    return Ok(
      new TodoList({
        ...props,
        isDefault: props.isDefault ?? false,
      } as TodoListProps),
    );
  }

  static reconstitute(props: TodoListProps, id: string): TodoList {
    return new TodoList(props, id);
  }
}
