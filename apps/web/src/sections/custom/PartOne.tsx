import { useState } from "react";
import { PRINCIPLES, fieldById, principleById, PENDING, forecastColours } from "@pmw/engine";
import { useStore } from "../../lib/store.tsx";
import { useAssist, ResultView, type AssistRun } from "../../components/Assist.tsx";
import { ResearchPanel, SourceLink, type SourceRef } from "../../components/Research.tsx";
import { useForecastInputs } from "./Forecaster.tsx";

/** The "Start with" card under the 3 C's question. */
export function ChannelResult() {
  const { answers, ws } = useStore();
  const opt = fieldById("c3_awareness")?.options?.find((o) => o.value === answers.c3_awareness);
  const { run, busy, error } = useAssist();
  const [res, setRes] = useState<AssistRun | null>(null);
  if (!opt) return null;
  const google = ws?.channel === "google";
  return (
    <div className={`result ${google ? "" : "meta"}`}>
      <div className="r-title">
        <span className={`chip ${google ? "teal" : "red"}`} style={{ margin: 0 }}>
          Start with
        </span>
        <h2>{google ? "Google Ads" : "Meta Ads"}</h2>
      </div>
      <p>{opt.result}</p>
      <div className="r-applies">{opt.detail}</div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn small assist-btn"
          disabled={!!busy}
          onClick={async () => {
            const r = await run("explain_channel", "c3_awareness");
            if (r) setRes(r);
          }}
        >
          Explain this for my business
        </button>
        <span className="tiny muted">Your choice always wins.</span>
      </div>
      {busy && <div className="loading">{busy}</div>}
      {error && <div className="error">{error}</div>}
      {res && <ResultView action="explain_channel" run={res} onClose={() => setRes(null)} />}
    </div>
  );
}

export function SearchDemand() {
  const { ws, site } = useStore();
  const [seeds, setSeeds] = useState<string>("");
  const defaultSeeds: string[] = site?.profile?.seeds ?? [];
  return (
    <ResearchPanel recipe="search_demand" params={{ seeds: seeds.split(",").map((s) => s.trim()).filter(Boolean) }}>
      {(r) => (
        <div className="small">
          <p style={{ margin: "0 0 4px" }}>
            <strong>{Number(r.result.totalVolume ?? 0).toLocaleString("en-AU")}</strong> searches a month:{" "}
            {(r.result.top ?? r.result.terms ?? [])
              .slice(0, 5)
              .map((t: { keyword: string; volume: number | null }) => `${t.keyword} (${t.volume === null || t.volume === undefined ? "no data" : Number(t.volume).toLocaleString("en-AU")})`)
              .join(", ")}
          </p>
          {r.result.nudge && <div className="note gold inset">{r.result.nudge}</div>}
          {!r.result.nudge && PENDING.searchDemandThreshold.value === null && <p className="tiny muted">The search volume rule isn't set up yet, so there's no nudge either way.</p>}
          {ws?.channel && <p className="tiny muted">Your pick stays {ws.channel === "google" ? "Google" : "Meta"} unless you change it.</p>}
          <input
            className="input"
            style={{ marginTop: 6 }}
            aria-label="Search terms to check"
            placeholder={defaultSeeds.length ? `Check other terms, comma separated (we used ${defaultSeeds.slice(0, 3).join(", ")})` : "Check other terms, comma separated, like plumber parramatta"}
            value={seeds}
            onChange={(e) => setSeeds(e.target.value)}
          />
        </div>
      )}
    </ResearchPanel>
  );
}

export function PrinciplesCards() {
  return (
    <div className="cards c2" style={{ marginBottom: 14 }}>
      {PRINCIPLES.map((p) => (
        <div className="card navy" key={p.id} style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "26px 1fr" }}>
          <span className="mono" style={{ color: "var(--orange-ink)", fontSize: "0.7rem", paddingTop: 3 }}>
            {p.number}
          </span>
          <div>
            <h3 style={{ margin: "0 0 2px" }}>{p.title}</h3>
            <p className="small" style={{ margin: 0, color: "var(--muted)" }}>
              {p.idea}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Diagnose() {
  const input = useForecastInputs();
  const { ws } = useStore();
  const colours = forecastColours(input, ws?.audience_type ?? "b2c");
  const red = Object.entries(colours)
    .filter(([, c]) => c === "red")
    .map(([k]) => k);
  const [text, setText] = useState("");
  const { run, busy, error } = useAssist();
  const [res, setRes] = useState<AssistRun | null>(null);
  return (
    <div className="card">
      <div className="chip gold">Diagnose</div>
      <p className="lead">Describe what isn't working. You'll get the principle being broken, where to look first, and one test to run.{red.length > 0 && ` Red dials in your forecast: ${red.join(", ")}.`}</p>
      <div className="input-row">
        <input className="input" value={text} placeholder="e.g. lots of clicks but hardly anyone fills in the form" onChange={(e) => setText(e.target.value)} />
        <button
          type="button"
          className="btn assist-btn"
          disabled={!!busy || (!text.trim() && !red.length)}
          onClick={async () => {
            const r = await run("diagnose", "pr_diagnose", text, { red_dials: red });
            if (r) setRes(r);
          }}
        >
          Diagnose
        </button>
      </div>
      {busy && <div className="loading">{busy}</div>}
      {error && <div className="error">{error}</div>}
      {res && <ResultView action="diagnose" run={res} onClose={() => setRes(null)} />}
      {res?.output?.principle && principleById(String(res.output.principle).slice(0, 3)) && <p className="tiny muted">{principleById(String(res.output.principle).slice(0, 3))!.idea}</p>}
    </div>
  );
}

interface Phrase {
  phrase: string;
  type: string;
  source?: string | SourceRef;
}

const srcUrl = (s: Phrase["source"]) => (typeof s === "string" ? s : (s?.url ?? undefined));

export function LanguageBank() {
  const { answers, setAnswer } = useStore();
  const bank = (Array.isArray(answers.av_language_bank) ? answers.av_language_bank : []) as Phrase[];
  const [draft, setDraft] = useState("");
  const add = (p: Phrase) => {
    if (bank.some((b) => b.phrase === p.phrase)) return;
    setAnswer("av_language_bank", [...bank, p]);
  };
  const sendToRow = (p: Phrase) => {
    const base = p.type === "pain" ? "av_away" : p.type === "attempt" ? "av_attempts" : "av_towards";
    const n = base === "av_attempts" ? 6 : 5;
    for (let i = 1; i <= n; i++) {
      if (!answers[`${base}_${i}`]) {
        setAnswer(`${base}_${i}`, p.phrase, { origin: "suggestion" });
        return;
      }
    }
  };
  return (
    <div className="card">
      <div className="chip teal">Words your customers use</div> <span className="tag">New</span>
      {bank.length === 0 && <p className="lead">Nothing here yet. Add phrases you hear from customers, or find them with market data.</p>}
      <div className="btn-row" style={{ marginBottom: 8 }}>
        {bank.map((p, i) => (
          <span key={i} className="tag" style={{ fontSize: "0.72rem", textTransform: "none", letterSpacing: 0 }}>
            “{p.phrase}”
            {srcUrl(p.source) && (
              <a href={srcUrl(p.source)} target="_blank" rel="noopener noreferrer nofollow" aria-label="source">
                ↗
              </a>
            )}
            <button type="button" className="btn ghost small" style={{ minHeight: 0, padding: 0 }} aria-label="Remove" onClick={() => setAnswer("av_language_bank", bank.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="input-row">
        <input className="input" placeholder="Add a phrase a customer said" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button
          type="button"
          className="btn"
          disabled={!draft.trim()}
          onClick={() => {
            add({ phrase: draft.trim(), type: "phrase" });
            setDraft("");
          }}
        >
          Add
        </button>
      </div>
      <div style={{ marginTop: 12 }}>
        <ResearchPanel recipe="customer_language">
          {(r) => (
            <div className="assist-cards">
              {((r.result.cards ?? []) as Phrase[])
                .filter((p) => p.source)
                .map((p, i) => (
                  <div key={i} className="assist-card">
                    <div>“{p.phrase}”</div>
                    <div className="meta">
                      <span className="tag">{p.type}</span> <SourceLink source={typeof p.source === "string" ? { url: p.source } : p.source} />
                    </div>
                    <div className="btn-row" style={{ marginTop: 6 }}>
                      <button type="button" className="btn small" onClick={() => add({ ...p, source: srcUrl(p.source) })}>
                        Add to my words
                      </button>
                      <button type="button" className="btn small" onClick={() => sendToRow(p)}>
                        Send to my avatar
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </ResearchPanel>
      </div>
    </div>
  );
}

export function CurrentHeadline() {
  const { site } = useStore();
  const h = site?.status === "confirmed" ? site.profile?.headline?.text : null;
  if (!h) return null;
  return (
    <div className="note gold">
      <span className="tag market">From your website</span> Your current headline: “{h}”
    </div>
  );
}

export function CompetitorMessages() {
  return (
    <ResearchPanel recipe="competitor_messages">
      {(r) => (
        <div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Competitor</th>
                  <th>Their headline</th>
                </tr>
              </thead>
              <tbody>
                {(r.result.cards ?? []).map((h: { domain: string; headline: string; description?: string; source: SourceRef }, i: number) => (
                  <tr key={i}>
                    <td>
                      <SourceLink source={{ ...h.source, label: h.domain }} />
                    </td>
                    <td>
                      {h.headline}
                      {h.description && <div className="tiny muted">{h.description}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.result.repeated && (
            <p className="small">
              <strong>What they all say:</strong> {r.result.repeated}
            </p>
          )}
          {r.result.different && (
            <p className="small">
              <strong>Room to say something different:</strong> {r.result.different}
            </p>
          )}
        </div>
      )}
    </ResearchPanel>
  );
}
