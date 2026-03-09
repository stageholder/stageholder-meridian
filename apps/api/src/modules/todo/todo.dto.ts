import { z } from 'zod';

export const CreateTodoDto = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  status: z.enum(['todo', 'done']).optional().default('todo'),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional().default('none'),
  dueDate: z.string().optional(),
  doDate: z.string().optional(),
  listId: z.string().min(1, 'List is required'),
  assigneeId: z.string().optional(),
});
export type CreateTodoDto = z.infer<typeof CreateTodoDto>;

export const UpdateTodoDto = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['todo', 'done']).optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().nullable().optional(),
  doDate: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
});
export type UpdateTodoDto = z.infer<typeof UpdateTodoDto>;

export const ReorderTodosDto = z.object({
  items: z.array(z.object({
    id: z.string(),
    order: z.number(),
  })),
});
export type ReorderTodosDto = z.infer<typeof ReorderTodosDto>;

export const CreateSubtaskDto = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional().default('none'),
});
export type CreateSubtaskDto = z.infer<typeof CreateSubtaskDto>;

export const UpdateSubtaskDto = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum(['todo', 'done']).optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
});
export type UpdateSubtaskDto = z.infer<typeof UpdateSubtaskDto>;

export const ReorderSubtasksDto = z.object({
  items: z.array(z.object({
    id: z.string(),
    order: z.number(),
  })),
});
export type ReorderSubtasksDto = z.infer<typeof ReorderSubtasksDto>;
