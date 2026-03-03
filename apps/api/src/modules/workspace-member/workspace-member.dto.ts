import { z } from 'zod';

export const InviteMemberDto = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});
export type InviteMemberDto = z.infer<typeof InviteMemberDto>;

export const UpdateMemberRoleDto = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});
export type UpdateMemberRoleDto = z.infer<typeof UpdateMemberRoleDto>;
