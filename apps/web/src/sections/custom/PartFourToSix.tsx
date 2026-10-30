import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  prelaunchCheck,
  AUDIENCE_RULES,
  GOOGLE_AD_LIMITS,
  checkGoogleHeadline,
  checkGoogleDescription,
  closeOptions,
  evaluateBottlenecks,
  BOTTLENECKS,
  ratesFromActuals,
  applyPlaybook,
  importAdsCsv,
  FLAG_LABELS,
  nextReviewDate,
  tooSoonToJudge,
  forecast,
  formatCostEach,
  convertCpcCents,
  PENDING,
  type AdRow,
  type AdSetTemp,
  type PeriodActuals,
} from "@pmw/engine";
import { useStore } from "../../lib/store.tsx";
import { useAssist, ResultView, OptionCards, type AssistRun } from "../../components/Assist.tsx";
import { ResearchPanel } from "../../components/Research.tsx";
import { Tag, Working, useMoney, pct, eg } from "../../components/bits.tsx";
import { useForecastInputs } from "./Forecaster.tsx";
import { downloadCsv } from "../../lib/csv.ts";

// ---------- Meta Campaign ----------

export function PreLaunch() {
  const { answers, ws, track } = useStore();
  const r = prelaunchCheck(answers, { funnel: ws?.funnel_type });
  useEffect(() => {
    if (r.ready) track("prelaunch_ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.ready]);
  return (
    <div className={`card prelaunch ${r.ready ? "teal" : ""}`}>
      <div className="chip teal">Pre-launch check</div>
      <h2 style={{ color: r.ready ? "var(--teal)" : "var(--ink)" }}>{r.ready ? "Ready to launch" : "Not ready yet"}</h2>
      <p className="lead">This check reads your whole workbook.</p>
      {r.items.map((i) => (
        <div key={i.id} className="check">
          <span aria-hidden="true" className={i.ok ? "pass" : "fail"} style={{ width: 20 }}>
            {i.ok ? "✓" : "✗"}
          </span>
          <span>
            {i.label}
            {i.detail && <span className="tiny muted"> ({i.detail})</span>}
            {!i.ok && (
              <>
                {" "}
                <Link to={`/workbook/${i.fixIn.section}`} className="small">
                  Fix →
                </Link>
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------- Google Search Campaign ----------

interface Kw {
  keyword: string;
  volume: number | null;
  cpcCents: number | null;
  intent?: string;
  include: boolean;
}

/** Ahrefs intents come back as flags; show the true ones in plain words. */
function intentLabel(v: unknown): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object")
    return Object.entries(v as Record<string, unknown>)
      .filter(([, on]) => on === true)
      .map(([k]) => k.replace(/^is_/, "").replace(/_/g, " "))
      .join(", ");
  return String(v);
}

export function GoogleKeywords({ panel }: { panel?: { chip?: string } }) {
  const { answers, setAnswer, ws } = useStore();
  const kws = (Array.isArray(answers.gs_keywords) ? answers.gs_keywords : []) as Kw[];
  const money = useMoney();
  const fx = PENDING.usdToAud.value;
  return (
    <div className="card">
      <div className="chip teal">{panel?.chip ?? "Keywords people type"}</div>
      <ResearchPanel recipe="keyword_plan">
        {(r) => {
          const found = ((r.result.keywords ?? []) as { keyword: string; volume: number | null; cpcCents?: number | null; intents?: unknown }[]).map((k) => ({
            keyword: k.keyword,
            volume: k.volume,
            cpcCents: k.cpcCents ?? null,
            intent: intentLabel(k.intents),
            include: true,
          }));
          return (
            <div>
              <p className="small">{found.length} keywords found.</p>
              <button type="button" className="btn small primary" onClick={() => setAnswer("gs_keywords", found, { origin: "suggestion", runId: r.id })}>
                Use this list
              </button>
              {r.result.groups && (
                <button type="button" className="btn small" style={{ marginLeft: 6 }} onClick={() => setAnswer("gs_groups", (r.result.groups as { name: string; keywords: string[] }[]).map((g) => `${g.name}: ${g.keywords.join(", ")}`).join("\n"), { origin: "suggestion" })}>
                  Use the suggested groups
                </button>
              )}
            </div>
          );
        }}
      </ResearchPanel>
      {kws.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Include</th>
                <th>Keyword</th>
                <th className="num">Monthly searches</th>
                <th className="num">Cost per click</th>
                <th>Intent</th>
              </tr>
            </thead>
            <tbody>
              {kws.map((k, i) => {
                const local = k.cpcCents === null ? null : convertCpcCents(k.cpcCents, fx, ws?.currency ?? "AUD");
                return (
                  <tr key={k.keyword}>
                    <td>
                      <input type="checkbox" aria-label={`Include ${k.keyword}`} checked={k.include} onChange={(e) => setAnswer("gs_keywords", kws.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
                    </td>
                    <td>{k.keyword}</td>
                    <td className="num">{k.volume?.toLocaleString("en-AU") ?? ""}</td>
                    <td className="num">{k.cpcCents === null ? "" : local !== null ? money(local, 2) : `US$${(k.cpcCents / 100).toFixed(2)}`}</td>
                    <td>{k.intent}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {kws.length > 0 && (
        <p className="tiny muted">
          <Tag kind="market" /> Ahrefs. Cost per click is reported in US dollars{fx === null ? "; no exchange rate is set yet, so it's shown in US dollars." : ` and converted at ${fx} (${PENDING.usdToAud.asOf}).`}
        </p>
      )}
    </div>
  );
}

function AdLines({ id, max, limit, label, check }: { id: "gs_headlines" | "gs_descriptions"; max: number; limit: number; label: string; check: (t: string) => { ok: boolean; length: number } }) {
  const { answers, setAnswer, pack } = useStore();
  const lines = (Array.isArray(answers[id]) ? answers[id] : []) as string[];
  const { run, busy, error } = useAssist();
  const [res, setRes] = useState<AssistRun | null>(null);
  const rows = lines.length ? lines : [""];
  const set = (i: number, v: string) => setAnswer(id, rows.map((x, j) => (j === i ? v : x)));
  return (
    <div className="field">
      <div className="label">
        {label} (up to {max}, {limit} characters each)
      </div>
      {rows.map((l, i) => {
        const c = check(l);
        return (
          <div className="input-row" key={i} style={{ marginBottom: 6 }}>
            <input className={`input ${l && !c.ok ? "dial-red" : ""}`} value={l} placeholder={eg(pack, `${id}_${i + 1}`)} aria-label={`${label} ${i + 1}`} onChange={(e) => set(i, e.target.value)} />
            <span className={`tiny ${c.ok ? "muted" : "fail"}`} style={{ width: 52, textAlign: "right" }}>
              {c.length}/{limit}
            </span>
          </div>
        );
      })}
      <div className="btn-row">
        <button type="button" className="btn small" disabled={rows.length >= max} onClick={() => setAnswer(id, [...rows, ""])}>
          Add
        </button>
        <button
          type="button"
          className="btn small assist-btn"
          disabled={!!busy}
          onClick={async () => {
            const r = await run("suggest", id);
            if (r) setRes(r);
          }}
        >
          Suggest from my messaging
        </button>
        <button
          type="button"
          className="btn small assist-btn"
          disabled={!!busy || !rows.some(Boolean)}
          onClick={async () => {
            const r = await run("check", id, rows.filter(Boolean).join("\n"));
            if (r) setRes(r);
          }}
        >
          Check
        </button>
      </div>
      {busy && <div className="loading">{busy}</div>}
      {error && <div className="error">{error}</div>}
      {res &&
        (res.output.options ? (
          <OptionCards
            run={res}
            onUse={(t) => {
              const filled = rows.filter(Boolean);
              if (filled.length < max) setAnswer(id, [...filled, t], { origin: "suggestion", runId: res.runId });
            }}
            onClose={() => setRes(null)}
          />
        ) : (
          <ResultView action="check" run={res} onClose={() => setRes(null)} />
        ))}
    </div>
  );
}

export function GoogleAds({ panel }: { panel?: { chip?: string; tone?: string } }) {
  const { answers } = useStore();
  const L = GOOGLE_AD_LIMITS;
  const exportCsv = () => {
    const kws = ((answers.gs_keywords ?? []) as Kw[]).filter((k) => k.include);
    const groups = String(answers.gs_groups ?? "")
      .split("\n")
      .map((l) => l.split(":"))
      .filter((p) => p.length >= 2)
      .map(([name, list]) => ({ name: name.trim(), keywords: list.split(",").map((s) => s.trim()).filter(Boolean) }));
    const rows: (string | number)[][] = [["Ad group", "Keyword", "Criterion type", "Negative", "Headline", "Description"]];
    const groupFor = (k: string) => groups.find((g) => g.keywords.includes(k))?.name ?? "Main";
    for (const k of kws) rows.push([groupFor(k.keyword), k.keyword, "Phrase", "", "", ""]);
    for (const n of (answers.gs_negatives ?? []) as string[]) rows.push(["", n, "", "Yes", "", ""]);
    for (const h of ((answers.gs_headlines ?? []) as string[]).filter(Boolean)) rows.push(["", "", "", "", h, ""]);
    for (const d of ((answers.gs_descriptions ?? []) as string[]).filter(Boolean)) rows.push(["", "", "", "", "", d]);
    downloadCsv("google-search-campaign.csv", rows);
  };
  return (
    <div className="card">
      <div className="chip gold">{panel?.chip ?? "Your ads"}</div>
      <p className="small muted">Use the searcher's words (Principle 03) and promise only what your landing page delivers (Principle 04).</p>
      <AdLines id="gs_headlines" max={L.maxHeadlines.value} limit={L.headlineChars.value} label="Ad headlines" check={checkGoogleHeadline} />
      <AdLines id="gs_descriptions" max={L.maxDescriptions.value} limit={L.descriptionChars.value} label="Ad descriptions" check={checkGoogleDescription} />
      <button type="button" className="btn small" onClick={exportCsv}>
        Download for Google Ads Editor
      </button>
      <p className="tiny muted">Check the column names against Google Ads Editor's import before uploading.</p>
    </div>
  );
}

export function GoogleBudgetCheck() {
  const { answers, ws } = useStore();
  const money = useMoney();
  const kws = ((answers.gs_keywords ?? []) as Kw[]).filter((k) => k.include && k.cpcCents !== null);
  const daily = typeof answers.fc_daily_budget === "number" ? answers.fc_daily_budget : null;
  const fx = PENDING.usdToAud.value;
  const avgCents = kws.length ? kws.reduce((a, k) => a + (k.cpcCents ?? 0), 0) / kws.length : null;
  const avgLocal = avgCents === null ? null : convertCpcCents(avgCents, fx, ws?.currency ?? "AUD");
  const ownCpc = typeof answers.fc_cpc === "number" ? answers.fc_cpc : null;
  const cpc = ownCpc ?? avgLocal;
  return (
    <div className="card">
      <div className="chip teal">Clicks your budget buys</div>
      {daily === null || cpc === null ? (
        <p className="small muted">Set a daily budget in Forecasting and pick keywords (or enter your own cost per click) to see this.</p>
      ) : (
        <>
          <p>
            About <strong>{(daily / cpc).toFixed(1)}</strong> clicks a day
          </p>
          <Working formula="Clicks a day = daily budget / average cost per click" inputs={{ dailyBudget: daily, costPerClick: cpc }} render={(_, v) => money(v, 2)} />
          <p className="tiny">
            {ownCpc !== null ? <Tag kind="input" /> : <Tag kind="market" />} {ownCpc !== null ? "Your cost per click" : "Average across your included keywords"}
          </p>
        </>
      )}
    </div>
  );
}

// ---------- Audiences ----------

export function AudienceRules() {
  const { answers } = useStore();
  const events = typeof answers.au_pixel_events === "number" ? answers.au_pixel_events : null;
  const list = typeof answers.au_customer_list_size === "number" ? answers.au_customer_list_size : null;
  const minEvents = AUDIENCE_RULES.warmMinPixelEvents.value;
  const minList = AUDIENCE_RULES.lookalikeMinList.value;
  const { run, busy, error } = useAssist();
  const [res, setRes] = useState<AssistRun | null>(null);
  const ideas = (Array.isArray(answers.ap_ideas) ? answers.ap_ideas : []) as { idea: string }[];
  return (
    <div className="card">
      {events === null ? (
        <p className="small muted">Enter your pixel event count to see what to do next.</p>
      ) : events < minEvents ? (
        <div className="note">
          <strong>Cold only for now.</strong> You have {events.toLocaleString("en-AU")} events; warm audiences unlock at {minEvents}.
        </div>
      ) : (
        <div>
          <p>
            <strong>Warm audiences unlocked.</strong> Add them in this order:
          </p>
          <ol className="small" style={{ paddingLeft: 18 }}>
            <li>All website visitors (180 days)</li>
            <li>IG profile engagers (365 days)</li>
            <li>Facebook page engagers (365 days), combined with IG into one warm ad set</li>
            <li>Video viewers 10+ seconds (180 days)</li>
            <li>Customer list (email upload)</li>
          </ol>
        </div>
      )}
      {list !== null && list < minList && <div className="note small">Skip the lookalike for now; use the list for re-engagement only.</div>}
      {list !== null && list >= minList && <div className="note small">Your list is big enough for a useful lookalike.</div>}
      <p className="tiny muted">
        Rules from the course: warm audiences at {minEvents}+ pixel events; lookalikes at {minList.toLocaleString("en-AU")}+ contacts.
      </p>
      {ideas.length > 0 && (
        <>
          <button
            type="button"
            className="btn small assist-btn"
            disabled={!!busy}
            onClick={async () => {
              const r = await run("which_warm", "au_which_warm");
              if (r) setRes(r);
            }}
          >
            Which ads for warm?
          </button>
          {busy && <div className="loading">{busy}</div>}
          {error && <div className="error">{error}</div>}
          {res && (
            <div className="assist-card" style={{ marginTop: 8 }}>
              <Tag kind="suggestion" />
              <ul className="small" style={{ paddingLeft: 18 }}>
                {(res.output.ads as { index: number; warm: boolean; reason: string }[])
                  .filter((a) => a.warm)
                  .map((a) => (
                    <li key={a.index}>
                      {a.index}. {ideas[a.index - 1]?.idea}: <span className="muted">{a.reason}</span>
                    </li>
                  ))}
              </ul>
              <button type="button" className="btn ghost small" onClick={() => setRes(null)}>
                Close
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Sales ----------

export function CloseOptions() {
  const { answers } = useStore();
  const money = useMoney();
  const price = typeof answers.fc_offer_price === "number" ? answers.fc_offer_price : null;
  const uplift = typeof answers.sa_plan_uplift === "number" ? answers.sa_plan_uplift : null;
  const c = closeOptions(price, uplift);
  return (
    <div className="card">
      <div className="chip gold">Your two close options</div>
      {c.onePayment === null ? (
        <p className="small muted">Set your offer price in Forecasting first.</p>
      ) : (
        <>
          <p>
            "One payment at <strong>{money(c.onePayment)}</strong>, or 3 months at <strong>{c.monthly === null ? "[set the extra above]" : money(c.monthly, 2)}</strong> a month. Which suits you better?"
          </p>
          <Working formula={c.formula} inputs={{ offerPrice: c.inputs.offerPrice, extraForPaymentPlan: c.inputs.uplift }} render={(k, v) => (k === "offerPrice" ? money(v) : pct(v))} />
          <p className="tiny">
            <Tag kind="input">From your inputs</Tag>
          </p>
        </>
      )}
    </div>
  );
}

export function CallSheet() {
  const { answers } = useStore();
  const [open, setOpen] = useState(false);
  const money = useMoney();
  const c = closeOptions(typeof answers.fc_offer_price === "number" ? answers.fc_offer_price : null, typeof answers.sa_plan_uplift === "number" ? answers.sa_plan_uplift : null);
  const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  if (!open)
    return (
      <div className="card">
        <div className="chip teal">Call sheet</div>
        <p className="lead">All five stages on one printable page, with your own lines, pillar notes and close options.</p>
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Open my call sheet
        </button>
      </div>
    );
  return (
    <div className="card span-all">
      <div className="btn-row no-print">
        <button type="button" className="btn small" onClick={() => window.print()}>
          Print
        </button>
        <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <h2>Call sheet</h2>
      <h3>01 Open (30 sec)</h3>
      <p>{String(answers.sa_agenda ?? "[your agenda line]")}</p>
      <h3>02 Discover (10-15 min)</h3>
      <ul>
        {list(answers.sa_discover).map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
      <p className="small muted">Ask one question, then stop talking.</p>
      <h3>03 Recap (30-60 sec)</h3>
      <p className="small">Mirror their most painful words, word for word.</p>
      <h3>04 Pitch (10-15 min)</h3>
      <p>
        <strong>Pillar 1:</strong> {String(answers.sa_pillar_1 ?? answers.vsl_pillar1 ?? "")}
      </p>
      <p>
        <strong>Pillar 2:</strong> {String(answers.sa_pillar_2 ?? answers.vsl_pillar2 ?? "")}
      </p>
      <p className="small">Tie-down after each: "Does that make sense? Could you see yourself using that?"</p>
      <h3>05 Close (2-5 min)</h3>
      <p>{c.onePayment !== null ? `One payment at ${money(c.onePayment)}, or 3 months at ${c.monthly === null ? "[monthly]" : money(c.monthly, 2)} a month. Which suits you better?` : "[set your offer price]"}</p>
      <h3>Objections</h3>
      <ul>
        {list(answers.sa_objections).map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
    </div>
  );
}

export function PracticeCall() {
  const { me } = useStore();
  const { run, busy, error } = useAssist();
  const [turns, setTurns] = useState<{ role: "seller" | "prospect"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<{ stage: string; ok: boolean; note: string }[] | null>(null);
  const MAX = 20;
  const send = async (text: string) => {
    const next = [...turns, { role: "seller" as const, text }];
    setTurns(next);
    setDraft("");
    const r = await run("practice_call", "sa_practice", text, { transcript: next.slice(-MAX) });
    if (r) {
      setTurns([...next, { role: "prospect", text: r.output.reply }]);
      if (r.output.done) setFeedback(r.output.feedback);
    }
  };
  return (
    <div className="card">
      <div className="chip teal">Practice call</div>
      {!me?.user.saved ? (
        <p className="small muted">
          Add your email to practise a call with a pretend prospect built from your avatar. <Link to="/save">Save my work</Link>
        </p>
      ) : (
        <>
          <p className="small muted">You're the seller. Start with your agenda. Type END when you want feedback. Up to {MAX} turns.</p>
          <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
            {turns.map((t, i) => (
              <div key={i} className={t.role === "prospect" ? "assist-card" : "note"} style={{ margin: 0 }}>
                <span className="tiny muted">{t.role === "prospect" ? "Prospect" : "You"}</span>
                <div>{t.text}</div>
              </div>
            ))}
          </div>
          {!feedback && turns.length < MAX * 2 && (
            <div className="input-row">
              <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && draft.trim() && !busy && send(draft.trim())} placeholder="What do you say?" />
              <button type="button" className="btn assist-btn" disabled={!draft.trim() || !!busy} onClick={() => send(draft.trim())}>
                Send
              </button>
            </div>
          )}
          {busy && <div className="loading">{busy}</div>}
          {error && <div className="error">{error}</div>}
          {feedback && (
            <div className="note">
              <strong>Feedback</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {feedback.map((f, i) => (
                  <li key={i}>
                    <span className={f.ok ? "pass" : "fail"}>{f.ok ? "Done" : "Work on"}</span> {f.stage}: {f.note}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  setTurns([]);
                  setFeedback(null);
                }}
              >
                Start again
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Optimising ----------

const ACTUAL_FIELDS: [keyof PeriodActuals, string][] = [
  ["spend", "Spend"],
  ["impressions", "Impressions"],
  ["clicks", "Link clicks"],
  ["leads", "Leads"],
  ["bookings", "Bookings"],
  ["shows", "Shows"],
  ["deals", "Deals"],
  ["revenue", "Revenue"],
];

const CHIP_TEXT: Record<number, string> = {
  1: "Link CTR < 1%",
  2: "CTR > 2% but poor opt-in",
  3: "Opt-in < 5%",
  4: "Booking < 30%",
  5: "Show rate < 65%",
  6: "Close rate < 25%",
};

export function Bottlenecks({ panel }: { panel?: { chip?: string; chipTone?: string; lead?: string; tone?: string } }) {
  const { answers, setAnswer, ws } = useStore();
  const period = (answers.op_period ?? {}) as PeriodActuals;
  const oneStep = ws?.funnel_type === "1step";
  const rates = ratesFromActuals(period, oneStep ? "1step" : "2step");
  const b = evaluateBottlenecks(rates);
  const hasNumbers = Object.values(rates).some((v) => v !== null);
  const { run, busy, error } = useAssist();
  const [res, setRes] = useState<AssistRun | null>(null);
  return (
    <div className="card">
      <div className={`chip ${panel?.chipTone ?? "teal"}`}>{panel?.chip ?? "Bottleneck checklist"}</div>
      {panel?.lead && <p className="lead">{panel.lead}</p>}
      <details className="script" open={hasNumbers} style={{ marginBottom: 10 }}>
        <summary>
          <span className="s-idea">Numbers for this review (7-14 days)</span>
          <span className="mono tiny muted">
            CTR {pct(rates.ctr, 2) || "?"} · Opt-in {pct(rates.optin) || "?"}
            {!oneStep && ` · Booking ${pct(rates.booking) || "?"}`} · Show {pct(rates.show) || "?"} · Close {pct(rates.close) || "?"}
          </span>
        </summary>
        <div className="s-body grid3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
          {ACTUAL_FIELDS.filter(([k]) => !(oneStep && k === "bookings")).map(([k, l]) => (
            <div className="field" key={k} style={{ margin: 0 }}>
              <label htmlFor={`op_${k}`}>{l}</label>
              <input
                id={`op_${k}`}
                className="input"
                inputMode="decimal"
                value={period[k] ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/[$,\s]/g, "");
                  setAnswer("op_period", { ...period, [k]: v === "" ? null : Number(v) });
                }}
              />
            </div>
          ))}
        </div>
      </details>
      {BOTTLENECKS.map((row) => {
        const first = b.first?.id === row.id;
        const later = b.afterThat.some((r) => r.id === row.id);
        return (
          <div key={row.id} className={`bn-row ${first ? "first" : later ? "later" : hasNumbers ? "clear" : ""}`}>
            <span className="bn-chip">{CHIP_TEXT[row.id]}</span>
            <div>
              {first && <strong className="fail">Fix this first: </strong>}
              {later && <strong style={{ color: "var(--gold)" }}>After that: </strong>}
              {row.check}
              {first && (
                <div className="btn-row" style={{ marginTop: 6 }}>
                  {row.sendTo.map((s) => (
                    <Link key={s.section + s.label} className="btn small" to={`/workbook/${s.section}`}>
                      Go to {s.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    className="btn small assist-btn"
                    disabled={!!busy}
                    onClick={async () => {
                      const r = await run("what_to_test", "op_test");
                      if (r) setRes(r);
                    }}
                  >
                    What should I test next?
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {busy && <div className="loading">{busy}</div>}
      {error && <div className="error">{error}</div>}
      {res && <ResultView action="what_to_test" run={res} onClose={() => setRes(null)} />}
      {hasNumbers && !b.first && <p className="small pass">No bottleneck triggered. Keep reviewing every 7-14 days.</p>}
      <p className="tiny muted" style={{ margin: "6px 0 0" }}>
        These lines (show under 65%, close under 25%) differ from the Forecasting targets on purpose: one plans, the other diagnoses. "Poor opt-in" in row 2 is read as under 5%.
      </p>
    </div>
  );
}

interface Review {
  date: string;
  ads: AdRow[];
}

export function Playbook() {
  const { answers, setAnswer } = useStore();
  const money = useMoney();
  const input = useForecastInputs();
  const f = forecast(input);
  const leadCost = f.byKey.leads?.costEach ?? f.byKey.deals?.costEach;
  const target = typeof answers.op_target_cpr === "number" ? answers.op_target_cpr : null;
  const ads = (Array.isArray(answers.op_ads) ? answers.op_ads : []) as AdRow[];
  const temps = (answers.op_adset_temp ?? {}) as Record<string, AdSetTemp>;
  const reviews = (Array.isArray(answers.op_reviews) ? answers.op_reviews : []) as Review[];
  const [err, setErr] = useState<string[]>([]);
  const nav = useAssist();
  const [more, setMore] = useState<{ ad: string; run: AssistRun } | null>(null);
  const last = reviews.length ? new Date(reviews[reviews.length - 1].date) : null;
  const tooSoon = reviews.length > 1 && tooSoonToJudge(new Date(reviews[reviews.length - 2].date), new Date(reviews[reviews.length - 1].date));
  const result = target !== null && ads.length ? applyPlaybook(ads, target, temps) : null;
  const adSets = [...new Set(ads.map((a) => a.adSet))];

  const onFile = async (file: File) => {
    const text = await file.text();
    const r = importAdsCsv(text);
    setErr(r.errors);
    if (!r.errors.length) {
      setAnswer("op_ads", r.ads);
      setAnswer("op_reviews", [...reviews, { date: new Date().toISOString(), ads: r.ads }]);
    }
  };

  return (
    <div className="card">
      <div className="chip gold">Your ads against the playbook</div>
      <div className="field">
        <label htmlFor="op_target_cpr">Target cost per result</label>
        <div className="input-row">
          <span className="affix">$</span>
          <input
            id="op_target_cpr"
            className="input"
            inputMode="decimal"
            value={target ?? ""}
            onChange={(e) => {
              const v = e.target.value.replace(/[$,\s]/g, "");
              setAnswer("op_target_cpr", v === "" ? null : Number(v));
            }}
          />
        </div>
        {typeof leadCost === "number" && (
          <div className="small" style={{ marginTop: 4 }}>
            <Tag kind="forecast" /> Cost per lead from your forecast: {formatCostEach(leadCost)}{" "}
            <button type="button" className="btn small" onClick={() => setAnswer("op_target_cpr", Math.round(leadCost * 100) / 100)}>
              Use this
            </button>
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor="op_csv">Results per ad (CSV from Ads Manager)</label>
        <p className="help">In Ads Manager, pick the Performance and Clicks view, add the Frequency column, then Export as CSV.</p>
        <input id="op_csv" type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {err.map((e) => (
          <div key={e} className="error">
            {e}
          </div>
        ))}
      </div>
      {last && (
        <p className="small">
          Next review: <strong>{nextReviewDate(last).toLocaleDateString("en-AU")}</strong>. Review every 7-14 days. Not daily, not hourly; daily checking creates anxiety and bad decisions.
        </p>
      )}
      {tooSoon && <div className="note warn small">Too soon to judge: this import is less than 7 days after the last one.</div>}
      {adSets.length > 0 && (
        <div className="field">
          <div className="label">Cold or warm, per ad set</div>
          {adSets.map((s) => (
            <div key={s} className="input-row" style={{ marginBottom: 6 }}>
              <span style={{ flex: 1 }}>{s || "(no ad set)"}</span>
              <select className="input" style={{ width: "auto" }} value={temps[s] ?? "cold"} onChange={(e) => setAnswer("op_adset_temp", { ...temps, [s]: e.target.value })}>
                <option value="cold">Cold</option>
                <option value="warm">Warm</option>
              </select>
            </div>
          ))}
        </div>
      )}
      {result && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ad</th>
                <th>Ad set</th>
                <th className="num">Spent</th>
                <th className="num">Results</th>
                <th className="num">Cost per result</th>
                <th className="num">Frequency</th>
                <th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {result.ads.map((a) => (
                <tr key={a.name + a.adSet}>
                  <td>{a.name}</td>
                  <td>{a.adSet}</td>
                  <td className="num">{money(a.spent)}</td>
                  <td className="num">{a.results}</td>
                  <td className="num">{a.cpr === null ? "none" : money(a.cpr, 2)}</td>
                  <td className="num">{a.frequency ?? ""}</td>
                  <td>
                    {a.flag !== "none" && <span className={`tag ${a.flag === "pause" ? "red" : a.flag === "consider_pausing" ? "gold" : a.flag === "winner" ? "green" : ""}`}>{FLAG_LABELS[a.flag]}</span>}
                    {a.reason && <div className="tiny muted">{a.reason}</div>}
                    {a.flag === "winner" && (
                      <button
                        type="button"
                        className="btn small assist-btn"
                        disabled={!!nav.busy}
                        onClick={async () => {
                          const r = await nav.run("more_like_this", "ap_ideas", a.name, { idea: a.name });
                          if (r) setMore({ ad: a.name, run: r });
                        }}
                      >
                        More like this
                      </button>
                    )}
                    {a.flag === "tired" && (
                      <Link className="btn small" to="/workbook/ad-principles">
                        Ideas for new ads
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result && (
        <p className="tiny muted">
          Sorted by amount spent, highest first. Median ad spend {money(result.medianSpend, 2)}. Pause at 3x target with no results, consider pausing at 2x (the app's reading of "2-3x").
        </p>
      )}
      {more && <OptionCards run={more.run} onUse={(t) => setAnswer("ap_ideas", [...((answers.ap_ideas as unknown[]) ?? []), { idea: t, source: `like ${more.ad}`, hook: "" }], { origin: "suggestion", runId: more.run.runId })} onClose={() => setMore(null)} />}
      {reviews.length > 0 && (
        <details>
          <summary className="small">Review history ({reviews.length})</summary>
          <ul className="small">
            {reviews.map((r, i) => (
              <li key={i}>
                {new Date(r.date).toLocaleDateString("en-AU")}: {r.ads.length} ads
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function WorkbookComplete() {
  const { sections, ws } = useStore();
  const done = new Set(ws?.completed_sections ?? []);
  const all = sections.every((s) => done.has(s.id) || s.id === "optimising");
  if (!all) return null;
  return (
    <div className="card" style={{ borderColor: "var(--green)", textAlign: "center" }}>
      <h2>Workbook complete</h2>
      <Link className="btn primary" to="/plan">
        See My Plan
      </Link>
    </div>
  );
}
