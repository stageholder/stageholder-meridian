import { readFileSync } from "node:fs";

import { env, OWNER_STATE, SESSION_KEY } from "./env";

/**
 * Setup/cleanup calls straight to the Meridian API with the saved session's
 * access token (never through the UI under test). Errors carry method, path,
 * status and a body excerpt only — never request headers, so tokens never
 * reach reports.
 */
export function tokenFrom(statePath: string): string {
  const state = JSON.parse(readFileSync(statePath, "utf8")) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  };
  const raw = state.origins
    ?.flatMap((o) => o.localStorage ?? [])
    .find((i) => i.name === SESSION_KEY)?.value;
  const token = (JSON.parse(raw ?? "{}") as { accessToken?: string })
    .accessToken;
  if (!token) throw new Error(`No Meridian session in ${statePath}`);
  return token;
}

export class MeridianApi {
  constructor(private readonly statePath: string = OWNER_STATE) {}

  async request<T = unknown>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${env.apiUrl}/api/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${tokenFrom(this.statePath)}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `${method} ${path} → ${res.status}: ${text.slice(0, 300)}`,
      );
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }

  get<T = unknown>(path: string) {
    return this.request<T>("GET", path);
  }
  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body ?? {});
  }
  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body ?? {});
  }
  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }

  /** Every item of a paginated `{ data, meta }` list. */
  async list<T extends { id: string }>(path: string): Promise<T[]> {
    const sep = path.includes("?") ? "&" : "?";
    const res = await this.get<{ data: T[] } | T[]>(`${path}${sep}limit=100`);
    return Array.isArray(res) ? res : res.data;
  }

  /**
   * Remove everything the journeys may have created, so every run starts
   * from the same empty Free-plan account (the plan caps habits at 3 and
   * active todos at 10, so leftovers would fail the next run).
   *
   * Only runs against a dedicated `jevb+…` test account: it deletes ALL
   * habits, todos, custom lists/groups and journal entries of that account.
   */
  async resetAccount(): Promise<void> {
    if (!/^jevb\+/i.test(env.email)) {
      throw new Error(
        "resetAccount() refuses to run: E2E_EMAIL is not a dedicated jevb+… test account",
      );
    }
    type Item = { id: string; isDefault?: boolean };
    const habits = [
      ...(await this.list<Item>("/habits")),
      ...(await this.list<Item>("/habits?archivedOnly=true")),
    ];
    for (const h of habits) await this.delete(`/habits/${h.id}`);
    for (const t of await this.list<Item>("/todos")) {
      await this.delete(`/todos/${t.id}`);
    }
    for (const l of await this.list<Item>("/todo-lists")) {
      if (!l.isDefault) await this.delete(`/todo-lists/${l.id}`);
    }
    for (const g of await this.list<Item>("/habit-groups")) {
      // The four seeded groups (Morning/Afternoon/Evening/Anytime) stay.
      if (!g.id.startsWith("hg-seed-"))
        await this.delete(`/habit-groups/${g.id}`);
    }
    for (const j of await this.list<Item>("/journals")) {
      await this.delete(`/journals/${j.id}`);
    }
  }
}
