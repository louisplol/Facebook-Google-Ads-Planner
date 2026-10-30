import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import "../styles/app.css";
import { adminGet, AdminError, getToken, setToken } from "./adminApi.ts";
import { Overview, Activity, Funnel, Workspaces, WorkspaceDetail, Assists, Research, Insights } from "./pages.tsx";

interface AuthCtx {
  onForbidden: () => void;
}

const Auth = createContext<AuthCtx>({ onForbidden: () => undefined });

/** Loads admin data; a 403 sends the owner to the sign-in form. */
export function useAdmin<T>(path: string, params: Record<string, string | undefined> = {}, refreshMs?: number) {
  const { onForbidden } = useContext(Auth);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `${path}?${JSON.stringify(params)}`;
  const load = useCallback(async () => {
    try {
      setData(await adminGet<T>(path, params));
      setError(null);
    } catch (e) {
      if (e instanceof AdminError && e.status === 403) onForbidden();
      else setError(e instanceof AdminError && e.status === 404 ? "Not found." : "Couldn't load this. Try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, onForbidden]);
  useEffect(() => {
    void load();
    if (!refreshMs) return;
    const t = window.setInterval(() => void load(), refreshMs);
    return () => window.clearInterval(t);
  }, [load, refreshMs]);
  return { data, error, reload: load };
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [token, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <main className="page">
      <h1>Admin sign in</h1>
      <div className="card">
        <p className="small">This area is for the owner only. Paste the ADMIN_DEV_TOKEN from your .dev.vars file.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setToken(token.trim());
            try {
              await adminGet("/whoami");
              onDone();
            } catch {
              setToken(null);
              setErr("That token didn't work.");
            }
          }}
        >
          <label className="sr-only" htmlFor="admin-token">
            Admin token
          </label>
          <input id="admin-token" className="input" type="password" autoComplete="off" value={token} onChange={(e) => setDraft(e.target.value)} />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="submit" className="btn primary" disabled={!token.trim()}>
              Sign in
            </button>
          </div>
          {err && <div className="error">{err}</div>}
        </form>
        <p className="tiny muted">In production, Cloudflare Access signs you in instead and this form isn't needed.</p>
      </div>
    </main>
  );
}

const NAV: [string, string][] = [
  ["/admin", "Overview"],
  ["/admin/activity", "Activity"],
  ["/admin/funnel", "Funnel"],
  ["/admin/workspaces", "Workspaces"],
  ["/admin/assists", "Assists"],
  ["/admin/research", "Research"],
  ["/admin/insights", "Market insights"],
];

function Shell({ email, children }: { email: string | null; children: ReactNode }) {
  const [brand, setBrand] = useState("");
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json() as Promise<{ brandName?: string }>)
      .then((c) => {
        setBrand(c.brandName ?? "");
        document.title = `Admin | ${c.brandName ?? ""}`;
      })
      .catch(() => undefined);
  }, []);
  return (
    <>
      <header className="topbar">
        <span className="brand admin-brand">
          <img src="/favicon.svg" alt="" width={24} height={24} />
          <span className="wordmark">{brand}</span> <span className="tag">Admin</span>
        </span>
        <span className="spacer" />
        {email && <span className="tiny muted">{email}</span>}
        {getToken() && (
          <button
            type="button"
            className="btn small ghost"
            onClick={() => {
              setToken(null);
              location.reload();
            }}
          >
            Sign out
          </button>
        )}
      </header>
      <main className="page wide">
        <nav className="admin-nav" aria-label="Admin">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/admin"} className={({ isActive }) => (isActive ? "active" : "")}>
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="tiny muted">Read only. Every view is logged.</p>
        {children}
      </main>
    </>
  );
}

export function Admin() {
  const [state, setState] = useState<"checking" | "in" | "out">("checking");
  const [email, setEmail] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const r = await adminGet<{ email: string }>("/whoami");
      setEmail(r.email);
      setState("in");
    } catch {
      setState("out");
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const onForbidden = useCallback(() => {
    setToken(null);
    setState("out");
  }, []);

  if (state === "checking") return <div className="page muted">Checking access...</div>;
  if (state === "out") return <SignIn onDone={() => void check()} />;
  return (
    <Auth.Provider value={{ onForbidden }}>
      <Shell email={email}>
        <Routes>
          <Route path="/admin" element={<Overview />} />
          <Route path="/admin/activity" element={<Activity />} />
          <Route path="/admin/funnel" element={<Funnel />} />
          <Route path="/admin/workspaces" element={<Workspaces />} />
          <Route path="/admin/workspaces/:id" element={<WorkspaceDetail />} />
          <Route path="/admin/assists" element={<Assists />} />
          <Route path="/admin/research" element={<Research />} />
          <Route path="/admin/insights" element={<Insights />} />
          <Route path="*" element={<Overview />} />
        </Routes>
      </Shell>
    </Auth.Provider>
  );
}
