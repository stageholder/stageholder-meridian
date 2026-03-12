import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser } from "@repo/core/types";
import type { StorageAdapter } from "@repo/core/platform";

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
}

export function createAuthStore(
  storage: StorageAdapter,
  onLogin?: (user: AuthUser) => void,
  onLogout?: () => void,
) {
  return create<AuthState>()(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,
        setUser: (user: AuthUser) => {
          onLogin?.(user);
          set({ user, isAuthenticated: true });
        },
        clearUser: () => {
          onLogout?.();
          set({ user: null, isAuthenticated: false });
        },
      }),
      {
        name: "auth-storage",
        storage: createJSONStorage(() => ({
          getItem: (key: string) => storage.getItem(key),
          setItem: (key: string, value: string) => {
            void storage.setItem(key, value);
          },
          removeItem: (key: string) => {
            void storage.removeItem(key);
          },
        })),
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      },
    ),
  );
}
