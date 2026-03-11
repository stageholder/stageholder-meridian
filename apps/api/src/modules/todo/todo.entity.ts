import { Entity, EntityProps, Ok, Err, Result, generateId } from "../../shared";

export type TodoStatus = "todo" | "done";
export type TodoPriority = "none" | "low" | "medium" | "high" | "urgent";

export interface SubtaskData {
  id: string;
  title: string;
  status: "todo" | "done";
  priority: TodoPriority;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoProps extends EntityProps {
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate?: string;
  doDate?: string;
  listId: string;
  workspaceId: string;
  assigneeId?: string;
  creatorId: string;
  order: number;
  subtasks: SubtaskData[];
}

export class Todo extends Entity<TodoProps> {
  private constructor(props: TodoProps, id?: string) {
    super(props, id);
  }

  get title(): string {
    return this.get("title");
  }
  get description(): string | undefined {
    return this.get("description");
  }
  get status(): TodoStatus {
    return this.get("status");
  }
  get priority(): TodoPriority {
    return this.get("priority");
  }
  get dueDate(): string | undefined {
    return this.get("dueDate");
  }
  get doDate(): string | undefined {
    return this.get("doDate");
  }
  get listId(): string {
    return this.get("listId");
  }
  get workspaceId(): string {
    return this.get("workspaceId");
  }
  get assigneeId(): string | undefined {
    return this.get("assigneeId");
  }
  get creatorId(): string {
    return this.get("creatorId");
  }
  get order(): number {
    return this.get("order");
  }
  get subtasks(): SubtaskData[] {
    return this.get("subtasks");
  }

  updateTitle(title: string): void {
    this.set("title", title);
  }
  updateDescription(description: string | undefined): void {
    this.set("description", description);
  }
  updateStatus(status: TodoStatus): void {
    this.set("status", status);
  }
  updatePriority(priority: TodoPriority): void {
    this.set("priority", priority);
  }
  updateDueDate(dueDate: string | undefined): void {
    this.set("dueDate", dueDate);
  }
  updateDoDate(doDate: string | undefined): void {
    this.set("doDate", doDate);
  }
  updateAssigneeId(assigneeId: string | undefined): void {
    this.set("assigneeId", assigneeId);
  }
  updateOrder(order: number): void {
    this.set("order", order);
  }

  addSubtask(
    title: string,
    priority: TodoPriority = "none",
  ): Result<SubtaskData> {
    const subtasks = this.subtasks;
    if (subtasks.length >= 50)
      return Err(new Error("Maximum 50 subtasks per todo"));
    const now = new Date().toISOString();
    const subtask: SubtaskData = {
      id: generateId(),
      title,
      status: "todo",
      priority,
      order: subtasks.length,
      createdAt: now,
      updatedAt: now,
    };
    this.set("subtasks", [...subtasks, subtask]);
    return Ok(subtask);
  }

  updateSubtask(
    subtaskId: string,
    updates: {
      title?: string;
      status?: "todo" | "done";
      priority?: TodoPriority;
    },
  ): Result<SubtaskData> {
    const subtasks = [...this.subtasks];
    const idx = subtasks.findIndex((s) => s.id === subtaskId);
    if (idx === -1) return Err(new Error("Subtask not found"));
    const now = new Date().toISOString();
    subtasks[idx] = { ...subtasks[idx]!, ...updates, updatedAt: now };
    this.set("subtasks", subtasks);
    return Ok(subtasks[idx]!);
  }

  removeSubtask(subtaskId: string): Result<void> {
    const subtasks = this.subtasks;
    const idx = subtasks.findIndex((s) => s.id === subtaskId);
    if (idx === -1) return Err(new Error("Subtask not found"));
    this.set(
      "subtasks",
      subtasks.filter((s) => s.id !== subtaskId),
    );
    return Ok(undefined);
  }

  reorderSubtasks(items: { id: string; order: number }[]): void {
    const subtasks = [...this.subtasks];
    for (const item of items) {
      const s = subtasks.find((s) => s.id === item.id);
      if (s) s.order = item.order;
    }
    this.set("subtasks", subtasks);
  }

  static create(
    props: Omit<TodoProps, "id" | "createdAt" | "updatedAt" | "subtasks">,
  ): Result<Todo> {
    if (!props.title || props.title.trim().length === 0)
      return Err(new Error("Todo title is required"));
    if (!props.listId) return Err(new Error("List is required"));
    if (!props.workspaceId) return Err(new Error("Workspace is required"));
    if (!props.creatorId) return Err(new Error("Creator is required"));
    return Ok(
      new Todo({
        ...props,
        status: props.status || "todo",
        priority: props.priority || "none",
        order: props.order ?? 0,
        subtasks: [],
      } as TodoProps),
    );
  }

  static reconstitute(props: TodoProps, id: string): Todo {
    return new Todo(props, id);
  }
}
