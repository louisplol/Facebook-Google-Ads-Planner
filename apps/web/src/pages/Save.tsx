import { useState } from "react";
import { useStore } from "../lib/store.tsx";
import { api, ApiError } from "../lib/api.ts";

export function Save() {
  const { me, flush } = useStore();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (me?.user.saved)
    return (
      <main className="page">
        <h1>Your work is saved</h1>
        <p>You're signed in as {me.user.email}. Open the workbook on any device with the same email.</p>
      </main>
    );
  return (
    <main className="page">
      <h1>Save my work</h1>
      <p>Add your email and we'll send a link. Open it on any device to pick up where you left off. Saving also unlocks more writing help and market research.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          await flush();
          try {
            setSent(await api.post<{ devLink?: string }>("/api/auth/magic-link", { email }));
          } catch (e2) {
            setErr(e2 instanceof ApiError && e2.code === "slow_down" ? "Too many tries. Wait a few minutes and try again." : "Couldn't send the link. Check the email address.");
          }
        }}
      >
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="btn primary" disabled={!email.includes("@")}>
          Send my link
        </button>
      </form>
      {err && <div className="error">{err}</div>}
      {sent && (
        <div className="note tip" style={{ marginTop: 16 }}>
          Check your email for the link. It works for 30 minutes.
          {sent.devLink && (
            <div className="small" style={{ marginTop: 6 }}>
              Local testing: <a href={sent.devLink}>open the link</a>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
