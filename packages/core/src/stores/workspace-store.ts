import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StorageAdapter } from '@repo/core/platform';

export interface WorkspaceState {
  activeWorkspaceId: string | null;
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  setActiveWorkspace: (workspaceId: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export function createWorkspaceStore(storage: StorageAdapter) {
  return create<WorkspaceState>()(
    persist(
      (set) => ({
        activeWorkspaceId: null,
        sidebarOpen: true,
        mobileSidebarOpen: false,
        setActiveWorkspace: (workspaceId: string) => set({ activeWorkspaceId: workspaceId }),
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
        setMobileSidebarOpen: (open: boolean) => set({ mobileSidebarOpen: open }),
      }),
      {
        name: 'workspace-storage',
        storage: createJSONStorage(() => ({
          getItem: (key: string) => storage.getItem(key),
          setItem: (key: string, value: string) => { void storage.setItem(key, value); },
          removeItem: (key: string) => { void storage.removeItem(key); },
        })),
        partialize: (state) => ({ activeWorkspaceId: state.activeWorkspaceId, sidebarOpen: state.sidebarOpen }),
      },
    ),
  );
}
