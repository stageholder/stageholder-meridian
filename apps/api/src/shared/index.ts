// Value re-exports (runtime) vs. type-only re-exports (erased). Bun does not
// usage-elide `export { X } from` re-exports — it resolves each name at the
// source module — so a type re-exported as a value throws
// "export 'X' not found" at load. Types MUST use `export type`.
export { Entity } from "./entity.base";
export type { EntityProps } from "./entity.base";

export { Ok, Err } from "./result";
export type { Result, AsyncResult } from "./result";

export { generateId, generateShortId } from "./id.utils";

export {
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "./pagination";
export type { PaginationParams, PaginatedResult } from "./pagination";
