import { createAuthStore } from "@repo/core/stores/auth-store";
import { LocalStorageAdapter } from "@repo/core/platform";

const storage = new LocalStorageAdapter();

export const useAuthStore = createAuthStore(storage);
