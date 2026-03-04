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

export interface Todo {
  id: string;
  workspaceId: string;
  listId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assigneeId?: string;
  creatorId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}
