import { createWorkspaceStore } from "@repo/core/stores/workspace-store";
import { LocalStorageAdapter } from "@repo/core/platform";

const storage = new LocalStorageAdapter();

export const useWorkspaceStore = createWorkspaceStore(storage);
