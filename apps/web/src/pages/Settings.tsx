import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { packByKey } from "@pmw/engine";
import { useStore } from "../lib/store.tsx";
import { api } from "../lib/api.ts";

export function Settings() {
  const { me, ws, switchWorkspace, newWorkspace } = useStore();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState("");
  return (
    <main className="page">
      <h1>Settings</h1>
      <div className="card">
        <h2>Your businesses</h2>
        <p className="small muted">One workspace per business or offer.</p>
        {me?.workspaces.map((w) => (
          <div key={w.id} className="check" style={{ alignItems: "center" }}>
            <span style={{ flex: 1 }}>
              {w.company || w.name}
              <span className="tiny muted" style={{ display: "block" }}>
                {packByKey(w.industry_pack).label}
              </span>
            </span>
            {w.id === ws?.id ? (
              <span className="tag green">Open</span>
            ) : (
              <button
                type="button"
                className="btn small"
                onClick={async () => {
                  await switchWorkspace(w.id);
                  nav(w.onboarding_done_at ? `/workbook/${w.last_section || "three-cs"}` : "/onboarding");
                }}
              >
                Open
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="btn"
          style={{ marginTop: 10 }}
          onClick={async () => {
            await newWorkspace();
            nav("/onboarding");
          }}
        >
          Add another business
        </button>
      </div>
      <div className="card">
        <h2>Account</h2>
        {me?.user.saved ? (
          <>
            <p>Signed in as {me.user.email}.</p>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                await api.post("/api/auth/logout");
                location.href = "/";
              }}
            >
              Sign out on this device
            </button>
          </>
        ) : (
          <p>
            Your work is saved to this browser's account. <Link to="/save">Add your email</Link> to open it anywhere.
          </p>
        )}
      </div>
      <div className="card">
        <h2>Delete my data</h2>
        <p className="small">This removes every workspace, answer, website scan, upload and writing help record for your account. It can't be undone.</p>
        <label htmlFor="confirm" className="small">
          Type DELETE to confirm
        </label>
        <input id="confirm" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button
          type="button"
          className="btn"
          style={{ marginTop: 8, borderColor: "var(--red)", color: "var(--red)" }}
          disabled={confirm !== "DELETE"}
          onClick={async () => {
            await api.del("/api/me");
            try {
              localStorage.clear();
            } catch {
              /* ignore */
            }
            location.href = "/";
          }}
        >
          Delete my data
        </button>
      </div>
      <p className="small">
        <Link to="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
