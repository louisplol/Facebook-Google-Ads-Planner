import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { forecast, prelaunchCheck, unitEconomics, type AdIdea, type ForecastInputs } from "@pmw/engine";
import { useStore } from "../lib/store.tsx";
import { api } from "../lib/api.ts";
import { ForecastTable, useForecastInputs } from "../sections/custom/Forecaster.tsx";
import { useMoney, Working, Tag } from "../components/bits.tsx";
import { downloadCsv } from "../lib/csv.ts";

const SCENARIO_FIELDS: { id: string; label: string; unit: "currency" | "percent" }[] = [
  { id: "fc_daily_budget", label: "Daily budget", unit: "currency" },
  { id: "fc_offer_price", label: "Offer price", unit: "currency" },
  { id: "fc_cpm", label: "CPM", unit: "currency" },
  { id: "fc_ctr", label: "Link CTR", unit: "percent" },
  { id: "fc_cpc", label: "Cost per click", unit: "currency" },
  { id: "fc_optin", label: "Opt-in", unit: "percent" },
  { id: "fc_booking", label: "Booking", unit: "percent" },
  { id: "fc_show", label: "Show", unit: "percent" },
  { id: "fc_close", label: "Close", unit: "percent" },
];

export function Plan() {
  const { ws, answers, scenarios, reload, sections, track, pack } = useStore();
  const base = useForecastInputs();
  const money = useMoney();
  const [editing, setEditing] = useState<{ id?: string; name: string; overrides: Record<string, number | null> } | null>(null);
  if (!ws) return <Navigate to="/" replace />;

  const done = new Set(ws.completed_sections ?? []);
  const ideas = (Array.isArray(answers.ap_ideas) ? answers.ap_ideas : []) as AdIdea[];
  const pre = prelaunchCheck(answers, { funnel: ws.funnel_type });
  const r = forecast(base);
  const ticks = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => answers[`${prefix}${i + 1}`] === true).filter(Boolean).length;
  const list = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => answers[`${prefix}_${i + 1}`])
      .filter((v) => typeof v === "string" && v.trim())
      .map(String);

  const applyOverrides = (o: Record<string, number | null>): ForecastInputs => ({
    ...base,
    dailyBudget: o.fc_daily_budget ?? base.dailyBudget,
    offerPrice: o.fc_offer_price ?? base.offerPrice,
    cpm: o.fc_cpm ?? base.cpm,
    ctr: o.fc_ctr ?? base.ctr,
    cpc: o.fc_cpc ?? base.cpc,
    optin: o.fc_optin ?? base.optin,
    booking: o.fc_booking ?? base.booking,
    show: o.fc_show ?? base.show,
    close: o.fc_close ?? base.close,
  });

  const saveScenario = async () => {
    if (!editing) return;
    const clean = Object.fromEntries(Object.entries(editing.overrides).filter(([, v]) => v !== null && Number.isFinite(v as number)));
    if (editing.id) await api.put(`/api/workspaces/${ws.id}/scenarios/${editing.id}`, { name: editing.name, overrides: clean });
    else await api.post(`/api/workspaces/${ws.id}/scenarios`, { name: editing.name, overrides: clean });
    setEditing(null);
    await reload();
  };

  const exportCsv = () => {
    track("export_csv");
    const rows: (string | number | null)[][] = [["Section", "Item", "Value"]];
    rows.push(["Business", "Name", ws.company ?? ws.name], ["Business", "Channel", ws.channel ?? ""], ["Business", "Funnel", ws.funnel_type ?? ""]);
    for (const l of r.lines) rows.push(["Forecast", `${l.label} (monthly)`, l.monthly], ["Forecast", `${l.label} (annual)`, l.annual]);
    rows.push(["Messaging", "Chosen headline", String(answers.msg_headline_chosen ?? "")], ["Messaging", "Sub-headline", String(answers.msg_subheadline ?? "")]);
    list("av_towards", 5).forEach((t) => rows.push(["Avatar", "Towards", t]));
    list("av_away", 5).forEach((t) => rows.push(["Avatar", "Away from", t]));
    list("av_attempts", 6).forEach((t) => rows.push(["Avatar", "Previous attempt", t]));
    ideas.forEach((i, n) => rows.push(["Ad ideas", `Idea ${n + 1}`, `${i.idea}${i.hook ? ` | Hook: ${i.hook}` : ""}`]));
    for (const s of scenarios) {
      const f = forecast(applyOverrides(s.overrides));
      rows.push(["Scenario", s.name, f.byKey.revenue?.monthly ?? null]);
    }
    downloadCsv("my-plan.csv", rows);
  };

  const sw = pack.software;
  const arpa = typeof answers.fc_sw_arpa === "number" ? answers.fc_sw_arpa : null;

  return (
    <main className="page wide">
      <div className="btn-row no-print" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <Link to={`/workbook/${ws.last_section || "three-cs"}`}>← Back to the workbook</Link>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              track("export_pdf");
              window.print();
            }}
          >
            Save as PDF
          </button>
          <button type="button" className="btn" onClick={exportCsv}>
            Download CSV
          </button>
        </div>
      </div>
      <h1>My Plan: {ws.company || ws.name}</h1>
      <p className="muted">
        {done.size} of {sections.length} sections done · {pre.ready ? "Ready to launch" : "Not ready to launch yet"}
      </p>

      <div className="kpi-row">
        <div className="kpi">
          <div className="l">Start with</div>
          <div className="v">{ws.channel === "google" ? "Google" : ws.channel === "meta" ? "Meta" : "Not picked"}</div>
        </div>
        <div className="kpi">
          <div className="l">Monthly revenue</div>
          <div className="v">{money(r.byKey.revenue?.monthly) || "?"}</div>
        </div>
        <div className="kpi">
          <div className="l">Monthly spend</div>
          <div className="v">{money(r.byKey.spend?.monthly) || "?"}</div>
        </div>
        <div className="kpi">
          <div className="l">Ad ideas</div>
          <div className="v">{ideas.length} of 12</div>
        </div>
      </div>

      <div className="card">
        <h2>Forecast</h2>
        <ForecastTable input={base} />
      </div>

      <div className="card no-print-break">
        <h2>What-if scenarios</h2>
        <p className="small muted">Try different numbers without changing your answers.</p>
        {scenarios.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th className="num">Monthly revenue</th>
                  <th className="num">Deals</th>
                  <th className="num">ROAS</th>
                  <th className="no-print" />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Your answers</td>
                  <td className="num">{money(r.byKey.revenue?.monthly)}</td>
                  <td className="num">{r.byKey.deals?.monthly?.toFixed(1) ?? ""}</td>
                  <td className="num">{r.roas?.toFixed(1) ?? ""}x</td>
                  <td />
                </tr>
                {scenarios.map((s) => {
                  const f = forecast(applyOverrides(s.overrides));
                  return (
                    <tr key={s.id}>
                      <td>
                        {s.name}
                        <div className="tiny muted">
                          {Object.entries(s.overrides)
                            .map(([k, v]) => `${SCENARIO_FIELDS.find((x) => x.id === k)?.label ?? k}: ${SCENARIO_FIELDS.find((x) => x.id === k)?.unit === "percent" ? `${+((v ?? 0) * 100).toFixed(2)}%` : v}`)
                            .join(", ")}
                        </div>
                      </td>
                      <td className="num">{money(f.byKey.revenue?.monthly)}</td>
                      <td className="num">{f.byKey.deals?.monthly?.toFixed(1) ?? ""}</td>
                      <td className="num">{f.roas?.toFixed(1) ?? ""}x</td>
                      <td className="no-print">
                        <button type="button" className="btn small" onClick={() => setEditing({ id: s.id, name: s.name, overrides: { ...s.overrides } })}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={async () => {
                            await api.del(`/api/workspaces/${ws.id}/scenarios/${s.id}`);
                            await reload();
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {editing ? (
          <div className="no-print">
            <div className="field">
              <label htmlFor="sc_name">Scenario name</label>
              <input id="sc_name" className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              {SCENARIO_FIELDS.filter((f) => (ws.channel === "google" ? !["fc_cpm", "fc_ctr"].includes(f.id) : f.id !== "fc_cpc")).map((f) => {
                const v = editing.overrides[f.id];
                const current = answers[f.id];
                return (
                  <div className="field" key={f.id} style={{ margin: 0 }}>
                    <label htmlFor={`sc_${f.id}`}>{f.label}</label>
                    <input
                      id={`sc_${f.id}`}
                      className="input"
                      inputMode="decimal"
                      placeholder={typeof current === "number" ? String(f.unit === "percent" ? +(current * 100).toFixed(2) : current) : ""}
                      value={v === undefined || v === null ? "" : String(f.unit === "percent" ? +(v * 100).toFixed(4) : v)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[$,%\s]/g, "");
                        const n = raw === "" ? null : Number(raw);
                        setEditing({ ...editing, overrides: { ...editing.overrides, [f.id]: n === null ? null : f.unit === "percent" ? n / 100 : n } });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button type="button" className="btn primary" disabled={!editing.name.trim()} onClick={saveScenario}>
                Save scenario
              </button>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn no-print" onClick={() => setEditing({ name: `Scenario ${scenarios.length + 1}`, overrides: {} })}>
            Add a scenario
          </button>
        )}
      </div>

      {sw && <SoftwareEconomics arpa={arpa} cac={typeof r.byKey.deals?.costEach === "number" ? r.byKey.deals.costEach : null} />}

      <div className="card">
        <h2>Customer avatar</h2>
        <p className="small">
          {[answers.av_age_range, answers.av_location, answers.av_industry].filter(Boolean).join(" · ")}
          {answers.av_descriptors ? <><br />{String(answers.av_descriptors)}</> : null}
        </p>
        <div className="cards">
          <div>
            <h3>Towards</h3>
            <ul className="small">{list("av_towards", 5).map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            <h3>Away from</h3>
            <ul className="small">{list("av_away", 5).map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            <h3>Previous attempts</h3>
            <ul className="small">{list("av_attempts", 6).map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Headline</h2>
        <p style={{ fontSize: "1.2rem", fontWeight: 600 }}>{String(answers.msg_headline_chosen ?? "Not chosen yet")}</p>
        {answers.msg_subheadline ? <p>{String(answers.msg_subheadline)}</p> : null}
      </div>

      <div className="card">
        <h2>Ad ideas</h2>
        <ol className="small">
          {ideas.map((i, n) => (
            <li key={n}>
              {i.idea}
              {i.hook && <div className="muted">Hook: {i.hook}</div>}
            </li>
          ))}
        </ol>
      </div>

      {answers.vsl_type ? (
        <div className="card">
          <h2>VSL outline ({answers.vsl_type === "story_arc" ? "Feedback Story Arc" : "Google Review"})</h2>
          {(answers.vsl_type === "story_arc"
            ? [
                ["First 30 seconds", answers.vsl_first30],
                ["Pillar 1", answers.vsl_pillar1],
                ["The Good Problem", answers.vsl_good_problem],
                ["Pillar 2", answers.vsl_pillar2],
                ["FAQ", answers.vsl_faq],
              ]
            : [
                ["Opening", answers.vsl_opening],
                ["Reviews", answers.vsl_reviews],
                ["Close", answers.vsl_close],
              ]
          ).map(([l, v]) => (
            <p key={String(l)} className="small">
              <strong>{String(l)}:</strong> {String(v ?? "")}
            </p>
          ))}
        </div>
      ) : null}

      <div className="card">
        <h2>Checklists</h2>
        <p className="small">
          Funnel build: {ticks("bf_build_", 9)} of {ws.funnel_type === "1step" ? 5 : 9} · Nurture: {ticks("bf_nurture_", 8)} of 8 · Campaign settings: {["mc_advantage_on", "mc_off_text", "mc_off_comments", "mc_off_media", "mc_off_image"].filter((k) => answers[k] === true).length} of 5
        </p>
        <ul className="small">
          {pre.items.map((i) => (
            <li key={i.id}>
              <span className={i.ok ? "pass" : "fail"}>{i.ok ? "✓" : "✗"}</span> {i.label}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function SoftwareEconomics({ arpa, cac }: { arpa: number | null; cac: number | null }) {
  const { answers, setAnswer } = useStore();
  const money = useMoney();
  const margin = typeof answers.fc_sw_margin === "number" ? answers.fc_sw_margin : null;
  const churn = typeof answers.fc_sw_churn === "number" ? answers.fc_sw_churn : null;
  const u = unitEconomics(arpa, margin, churn, cac);
  const pctInput = (id: string, label: string) => (
    <div className="field" style={{ margin: 0 }}>
      <label htmlFor={id}>{label}</label>
      <div className="input-row">
        <input
          id={id}
          className="input"
          inputMode="decimal"
          value={typeof answers[id] === "number" ? String(+((answers[id] as number) * 100).toFixed(4)) : ""}
          onChange={(e) => {
            const raw = e.target.value.replace(/[%\s]/g, "");
            setAnswer(id, raw === "" ? null : Number(raw) / 100);
          }}
        />
        <span className="affix">%</span>
      </div>
    </div>
  );
  return (
    <div className="card">
      <h2>Payback and lifetime value</h2>
      <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {pctInput("fc_sw_margin", "Gross margin")}
        {pctInput("fc_sw_churn", "Monthly churn")}
      </div>
      <p className="small">
        Lifetime value: <strong>{money(u.ltv) || "?"}</strong> · Payback: <strong>{u.paybackMonths === null ? "?" : `${u.paybackMonths.toFixed(1)} months`}</strong> · Lifetime value to cost: <strong>{u.ltvToCac === null ? "?" : `${u.ltvToCac.toFixed(1)}x`}</strong> <Tag kind="input">From your inputs</Tag>
      </p>
      <Working formula={`${u.formulas.ltv}. ${u.formulas.payback}. ${u.formulas.ratio}`} inputs={{ revenuePerAccount: arpa, grossMargin: margin, monthlyChurn: churn, costToWin: cac }} />
    </div>
  );
}
