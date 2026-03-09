export interface TodoList {
  id: string;
  workspaceId: string;
  name: string;
  color?: string;
  icon?: string;
  isShared: boolean;
  isDefault: boolean;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  status: 'todo' | 'done';
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  workspaceId: string;
  listId: string;
  title: string;
  description?: string;
  status: 'todo' | 'done';
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  doDate?: string;
  assigneeId?: string;
  creatorId: string;
  order: number;
  subtasks?: Subtask[];
  createdAt: string;
  updatedAt: string;
}
