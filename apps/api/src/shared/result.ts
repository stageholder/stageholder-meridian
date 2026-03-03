export type Result<T, E extends Error = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type AsyncResult<T, E extends Error = Error> = Promise<Result<T, E>>;

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E extends Error>(error: E): Result<never, E> {
  return { ok: false, error };
}
