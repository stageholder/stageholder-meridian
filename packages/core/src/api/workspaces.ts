import type { AxiosInstance } from 'axios';
import type { Workspace, WorkspaceMember } from '@repo/core/types';

export function createWorkspacesApi(client: AxiosInstance) {
  return {
    create: async (data: { name: string; description?: string }): Promise<Workspace> => {
      const res = await client.post('/workspaces', data);
      return res.data;
    },
    list: async (): Promise<Workspace[]> => {
      const res = await client.get('/workspaces');
      return res.data;
    },
    get: async (id: string): Promise<Workspace> => {
      const res = await client.get(`/workspaces/${id}`);
      return res.data;
    },
    update: async (id: string, data: { name?: string; description?: string }): Promise<Workspace> => {
      const res = await client.patch(`/workspaces/${id}`, data);
      return res.data;
    },
    delete: async (id: string): Promise<void> => {
      await client.delete(`/workspaces/${id}`);
    },
    inviteMember: async (workspaceId: string, data: { email: string; role?: string }): Promise<WorkspaceMember> => {
      const res = await client.post(`/workspaces/${workspaceId}/members/invite`, data);
      return res.data;
    },
    listMembers: async (workspaceId: string): Promise<WorkspaceMember[]> => {
      const res = await client.get(`/workspaces/${workspaceId}/members`);
      return res.data?.data ?? res.data;
    },
    updateMemberRole: async (workspaceId: string, memberId: string, data: { role: string }): Promise<WorkspaceMember> => {
      const res = await client.patch(`/workspaces/${workspaceId}/members/${memberId}`, data);
      return res.data;
    },
    removeMember: async (workspaceId: string, memberId: string): Promise<void> => {
      await client.delete(`/workspaces/${workspaceId}/members/${memberId}`);
    },
  };
}

export type WorkspacesApi = ReturnType<typeof createWorkspacesApi>;
