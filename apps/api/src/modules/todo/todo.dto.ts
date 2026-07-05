import { z } from "zod";

// Dates are stored as strings and compared lexically in date-range queries, so
// they must be a calendar day (`YYYY-MM-DD`) or an ISO timestamp that begins
// with one. Rejecting free-form strings keeps the lexical `$gte/$lt` range
// scans (calendar/upcoming) correct and guards `new Date(...)` parses.
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, "Date must be YYYY-MM-DD or ISO");

// Todos always start life open ("todo"): a done-on-create would escape the
// active-todo cap (which counts status != done) and skip completion Light, so
// `status` is intentionally not accepted here — use PATCH to complete.
export const CreateTodoDto = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional(),
  priority: z
    .enum(["none", "low", "medium", "high", "urgent"])
    .optional()
    .default("none"),
  dueDate: dateString.optional(),
  doDate: dateString.optional(),
  listId: z.string().min(1, "List is required"),
});
export type CreateTodoDto = z.infer<typeof CreateTodoDto>;

export const UpdateTodoDto = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(["todo", "done"]).optional(),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
  dueDate: dateString.nullable().optional(),
  doDate: dateString.nullable().optional(),
  // Move the todo to another of the user's lists. Validated for ownership in
  // the service; a foreign/unknown list id is rejected there.
  listId: z.string().min(1).optional(),
});
export type UpdateTodoDto = z.infer<typeof UpdateTodoDto>;

export const ReorderTodosDto = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      order: z.number(),
    }),
  ),
});
export type ReorderTodosDto = z.infer<typeof ReorderTodosDto>;

export const CreateSubtaskDto = z.object({
  title: z.string().min(1, "Title is required").max(500),
  priority: z
    .enum(["none", "low", "medium", "high", "urgent"])
    .optional()
    .default("none"),
});
export type CreateSubtaskDto = z.infer<typeof CreateSubtaskDto>;

export const UpdateSubtaskDto = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum(["todo", "done"]).optional(),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
});
export type UpdateSubtaskDto = z.infer<typeof UpdateSubtaskDto>;

export const ReorderSubtasksDto = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      order: z.number(),
    }),
  ),
});
export type ReorderSubtasksDto = z.infer<typeof ReorderSubtasksDto>;
