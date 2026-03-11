import { z } from "zod";

export const CreateWorkspaceDto = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});
export type CreateWorkspaceDto = z.infer<typeof CreateWorkspaceDto>;

export const UpdateWorkspaceDto = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});
export type UpdateWorkspaceDto = z.infer<typeof UpdateWorkspaceDto>;
