// Admin fetch helper. In production Cloudflare Access signs every request, so no token is needed.
// Locally there is no Access, so the owner pastes ADMIN_DEV_TOKEN once per browser session.

const TOKEN_KEY = "pmw_admin_token";

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage can be blocked; the token then lasts only for this page */
  }
}

export class AdminError extends Error {
  constructor(public status: number) {
    super(`Admin request failed (${status})`);
  }
}

export async function adminGet<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  const token = getToken();
  const res = await fetch(`/api/admin${path}${qs ? `?${qs}` : ""}`, {
    credentials: "same-origin",
    headers: token ? { "x-admin-token": token } : {},
  });
  if (!res.ok) throw new AdminError(res.status);
  return (await res.json()) as T;
}
