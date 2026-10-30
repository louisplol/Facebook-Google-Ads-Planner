import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store.tsx";

export function Home() {
  const { ws, me, config, newWorkspace } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const start = async () => {
    if (!ws) await newWorkspace();
    nav("/onboarding");
  };
  const continueTo = ws ? (ws.onboarding_done_at ? `/workbook/${ws.last_section || "three-cs"}` : "/onboarding") : null;

  return (
    <div className="home">
      <header className="home-bar">
        <span className="wordmark">{config?.brandName}</span>
        <span className="spacer" />
        {ws?.onboarding_done_at && (
          <Link className="btn small" to="/plan">
            My Plan
          </Link>
        )}
      </header>
      <main className="hero">
        <div className="hero-copy">
          {params.get("saved") && <div className="note teal">Your email is saved. You can open your workbook on any device.</div>}
          {params.get("link") === "expired" && <div className="note red">That link has expired or was already used. Ask for a new one from Save my work.</div>}
          <span className="kicker">Facebook and Google ads workbook</span>
          <h1>
            Paid ads you can plan, <em>launch</em> and measure.
          </h1>
          <p className="hero-sub">A step by step workbook for paid ads, from "Google or Meta?" to the sales call. Fill in your answers, tick off the checklists, and build your system with your own numbers, real market data and writing help on tap.</p>

          <div className="hero-actions">
            {continueTo ? (
              <Link className="btn primary big" to={continueTo}>
                Continue Workbook →
              </Link>
            ) : (
              <button type="button" className="btn primary big" onClick={start}>
                Start my workbook →
              </button>
            )}
            {continueTo && !me?.user.saved && (
              <Link className="btn big" to="/save">
                Save my work
              </Link>
            )}
            {continueTo && me && me.workspaces.length > 1 && (
              <Link className="btn big" to="/settings">
                Switch business
              </Link>
            )}
          </div>

          <p className="hero-meta">
            {continueTo ? <strong>✓ Saved progress found. </strong> : <strong>14 sections. </strong>}
            {me?.user.saved ? `You're saved as ${me.user.email}. Open it on any device with the same email.` : "Everything you type saves as you go. Add your email to open it on any device."}
          </p>
        </div>

        <figure className="fig" aria-hidden="true">
          <div className="fig-head">
            <span>Fig. 01</span>
            <span>Click to close</span>
          </div>
          <svg viewBox="0 0 360 250" className="fig-art">
            <path className="ln" d="M40 40h240l-70 80v70l-100 0v-70z" />
            <path className="ln-thin" d="M75 80h170M110 120h100" />
            <path className="ln-dash" d="M160 190v32" />
            <circle className="f-spot" cx="160" cy="228" r="6" />
            <path className="ln-spot" d="M232 170l34-40m0 0l-14 2m14-2l-1 14" />
            <circle className="f-cul" cx="78" cy="58" r="3" />
            <circle className="f-cul" cx="120" cy="62" r="3" />
            <circle className="f-cul" cx="196" cy="56" r="3" />
            <circle className="f-cul" cx="238" cy="62" r="3" />
            <circle className="f-cul" cx="140" cy="100" r="3" />
            <circle className="f-cul" cx="182" cy="100" r="3" />
            <circle className="f-cul" cx="160" cy="150" r="3" />
            <text className="tx" x="292" y="66">
              Click
            </text>
            <text className="tx" x="292" y="106">
              Lead
            </text>
            <text className="tx" x="292" y="156">
              Call
            </text>
            <text className="tx" x="176" y="232">
              Sale
            </text>
          </svg>
        </figure>
      </main>
      <footer className="home-foot">
        <Link to="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
