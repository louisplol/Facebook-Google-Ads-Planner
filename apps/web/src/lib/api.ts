// Thin wrappers around the app's own server routes. No keys ever live in the browser.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body instanceof FormData ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, String(data.error ?? "error"), String(data.message ?? "Something went wrong. Try again."));
  return data as T;
}

export const api = {
  get: <T>(url: string, headers?: Record<string, string>) => req<T>("GET", url, undefined, headers),
  post: <T>(url: string, body?: unknown, headers?: Record<string, string>) => req<T>("POST", url, body ?? {}, headers),
  put: <T>(url: string, body: unknown) => req<T>("PUT", url, body),
  patch: <T>(url: string, body: unknown) => req<T>("PATCH", url, body),
  del: <T>(url: string) => req<T>("DELETE", url),
};

export interface SseEvent {
  event: string;
  data: any;
}

/** POST that reads a server-sent event stream. Calls onEvent for each event. */
export async function postSse(url: string, body: unknown, onEvent: (e: SseEvent) => void): Promise<void> {
  const res = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(res.status, String(data.error ?? "error"), String(data.message ?? "That didn't work. Try again."));
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = /event: (.*)/.exec(block)?.[1] ?? "message";
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("\n");
      onEvent({ event, data: data ? JSON.parse(data) : null });
    }
  }
}
