// apps/mobile/lib/api/index.ts
//
// Public API surface. Everything else in this folder is internal to the
// data layer.

export {
  apiClient,
  ClientEvents,
  createMeridianClient,
  extractServerMessage,
  type ApiClient,
} from "./client";
export { QueryProvider, type QueryProviderProps } from "./Provider";
export { queryClient } from "./query-client";
export { todoKeys, todoListKeys, habitKeys, journalKeys } from "./keys";
export { getAccessToken, type GetAccessToken } from "./auth";

// Resource hooks — re-exported so consumers do `import { useTodos } from "@/lib/api"`.
export * from "./hooks/todos";
export * from "./hooks/habits";
export * from "./hooks/journal";
export * from "./hooks/today";
export * from "./hooks/light";
