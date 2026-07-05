export interface TodoList {
  id: string;
  userSub: string;
  name: string;
  color?: string;
  icon?: string;
  order: number;
  isDefault: boolean;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  status: "todo" | "done";
  priority: "none" | "low" | "medium" | "high" | "urgent";
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  userSub: string;
  listId: string;
  title: string;
  description?: string;
  status: "todo" | "done";
  priority: "none" | "low" | "medium" | "high" | "urgent";
  dueDate?: string;
  doDate?: string;
  creatorId: string;
  order: number;
  subtasks?: Subtask[];
  // ISO timestamp of when the todo was last completed (set on →done, cleared
  // on →todo). Prefer this over updatedAt for "completed on"/recency grouping.
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
