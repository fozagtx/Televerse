/**
 * Tiny fetch wrapper used by WebMCP tool handlers.
 *
 * All Televerse API routes are first-party and require the user's NextAuth
 * session cookie. We use `credentials: "include"` so the browser sends it
 * automatically; tools run on the same origin so there is no CORS surface.
 */

export class OpticonApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "OpticonApiError";
  }
}

interface OpticonFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function opticonFetch<T>(
  path: string,
  options: OpticonFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: body
      ? { "Content-Type": "application/json", Accept: "application/json" }
      : { Accept: "application/json" },
    signal,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(path, init);
  const text = await res.text();
  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // leave as text
    }
  }

  if (!res.ok) {
    const message =
      (typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : null) ?? `Request failed: ${res.status} ${res.statusText}`;
    throw new OpticonApiError(res.status, parsed, message);
  }

  return parsed as T;
}

/**
 * Render a tool result as a WebMCP-compatible string. The browser
 * (or our in-page test harness) accepts either a string or a structured
 * `{ content: [{ type: "text", text }] }` shape; we standardize on the
 * string form because it's what the model context hands back to the agent.
 */
export function renderToolResult(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}
