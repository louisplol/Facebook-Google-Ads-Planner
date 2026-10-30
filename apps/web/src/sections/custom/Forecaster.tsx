import { useMemo, useState, type ReactNode } from "react";
import {
  forecast,
  forecastColours,
  biggestDial,
  workBackwards,
  formatForecastCell,
  formatCostEach,
  FORECAST_BENCHMARKS,
  ARCHETYPE_STAGES,
  softwareForecast,
  convertCpcCents,
  PENDING,
  type ForecastInputs,
  type Colour,
} from "@pmw/engine";
import { useStore } from "../../lib/store.tsx";
import { Tag, Term, Working, useMoney, pct } from "../../components/bits.tsx";
import { useAssist, ResultView, type AssistRun } from "../../components/Assist.tsx";
import { useResearch } from "../../components/Research.tsx";
import { Panel } from "../SectionView.tsx";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Reads the forecast inputs from answers, with optional scenario overrides (which never change answers). */
export function useForecastInputs(overrides: Record<string, number | null> = {}): ForecastInputs {
  const { answers, ws } = useStore();
  const a = { ...answers, ...overrides };
  const funnel = (a.fc_funnel as ForecastInputs["funnel"]) || ws?.funnel_type || "2step";
  return {
    funnel: ws?.funnel_type === "checkout" ? "checkout" : funnel,
    channel: ws?.channel ?? "meta",
    dailyBudget: num(a.fc_daily_budget),
    offerPrice: num(a.fc_offer_price),
    cpm: num(a.fc_cpm),
    ctr: num(a.fc_ctr),
    cpc: num(a.fc_cpc),
    optin: num(a.fc_optin),
    booking: num(a.fc_booking),
    show: num(a.fc_show),
    close: num(a.fc_close),
    purchase: num(a.fc_purchase),
    margin: num(a.fc_margin),
  };
}

/** One input row: label, input, benchmark hint. */
function FcRow({ id, label, unit, hint, colour, term, extra }: { id: string; label: string; unit: "currency" | "percent" | "number"; hint?: string; colour?: Colour; term?: string; extra?: ReactNode }) {
  const { answers, setAnswer } = useStore();
  const v = num(answers[id]);
  const shown = v === null ? "" : unit === "percent" ? String(+(v * 100).toFixed(4)) : String(v);
  return (
    <div className="fc-row">
      <label htmlFor={id}>{term ? <Term id={term}>{label}</Term> : label}</label>
      <div className="input-row">
        {unit === "currency" && <span className="affix">$</span>}
        <input
          id={id}
          aria-label={label}
          className={`input ${colour && colour !== "none" ? `dial-${colour}` : ""}`}
          inputMode="decimal"
          value={shown}
          onChange={(e) => {
            const raw = e.target.value.replace(/[$,%\s]/g, "");
            const n = raw === "" ? null : Number(raw);
            if (n !== null && !Number.isFinite(n)) return;
            setAnswer(id, n === null ? null : unit === "percent" ? n / 100 : n);
          }}
        />
        {unit === "percent" && <span className="affix">%</span>}
      </div>
      <div className="hint" title={hint ? "Benchmark from the course" : undefined}>
        {hint}
        {extra}
      </div>
    </div>
  );
}

const MAJOR = new Set(["spend", "leads", "conversations"]);

export function ForecastTable({ input }: { input: ForecastInputs }) {
  const { ws } = useStore();
  const currency = ws?.currency ?? "AUD";
  const r = forecast(input);
  const money = useMoney();
  return (
    <div className="fc-panel">
      <div className="fc-head">Calculated outputs</div>
      <table className="fc-out">
        <thead>
          <tr>
            <th />
            <th className="num">Monthly</th>
            <th className="num">Annual</th>
            <th className="num">Cost ea</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l) =>
            l.key === "roas" ? (
              <tr key={l.key}>
                <td colSpan={4}>
                  <Term id="roas">ROAS</Term> {formatForecastCell(l.key, l.kind, "monthly", l.monthly, currency)}
                  <Working formula={l.formula} inputs={l.inputs} />
                </td>
              </tr>
            ) : (
              <tr key={l.key} className={l.key === "revenue" ? "rev" : MAJOR.has(l.key) ? "major" : ""}>
                <td>
                  {l.label}
                  <Working formula={l.formula} inputs={l.inputs} render={(k, v) => (/rate|ctr|optin|booking|show|close|margin|purchase/i.test(k) ? pct(v, 2) : /spend|price|revenue|cpm|cpc/i.test(k) ? money(v, 2) : v.toLocaleString("en-AU", { maximumFractionDigits: 2 }))} />
                </td>
                <td className="num">{formatForecastCell(l.key, l.kind, "monthly", l.monthly, currency)}</td>
                <td className="num">{formatForecastCell(l.key, l.kind, "annual", l.annual, currency)}</td>
                <td className="num cost">{l.costEach !== undefined ? formatCostEach(l.costEach, currency) : ""}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {!r.ok && <div className="tiny muted" style={{ padding: "8px 12px" }}>Add {r.missing.join(", ")} to see every line.</div>}
    </div>
  );
}

function CpcMarketHint() {
  const { setAnswer, ws } = useStore();
  const r = useResearch("search_demand");
  const avgCents = r.run?.status === "done" ? (r.run.result?.avgCpcCents ?? null) : null;
  if (avgCents === null || avgCents === undefined) return null;
  const local = convertCpcCents(avgCents, PENDING.usdToAud.value, ws?.currency ?? "AUD");
  return (
    <div>
      <Tag kind="market" /> US${(avgCents / 100).toFixed(2)}
      {local !== null && (
        <button type="button" className="btn small" onClick={() => setAnswer("fc_cpc", Number(Number(local).toFixed(2)))}>
          Use ${Number(local).toFixed(2)}
        </button>
      )}
    </div>
  );
}

export function Forecaster({ panel }: { panel?: { chip?: string; chipTone?: string; lead?: string; tone?: string } }) {
  const { answers, setAnswer, ws, site, pack } = useStore();
  const input = useForecastInputs();
  const audience = ws?.audience_type ?? pack.audience_type;
  const colours = forecastColours(input, audience);
  const money = useMoney();
  const dials = useMemo(() => biggestDial(input), [input]);
  const goal = num(answers.fc_revenue_goal);
  const capacity = num(answers.fc_weekly_capacity);
  const back = goal ? workBackwards(input, goal, capacity) : null;
  const google = input.channel === "google";
  const checkout = input.funnel === "checkout";
  const { run, busy, error } = useAssist();
  const [explain, setExplain] = useState<AssistRun | null>(null);
  const B = FORECAST_BENCHMARKS;
  const sitePrice = site?.status === "confirmed" ? site.profile?.prices?.[0]?.text : null;

  return (
    <>
      <Panel block={panel ?? {}}>
        {!checkout && (
          <div className="choice two" role="radiogroup" aria-label="2-Step or 1-Step funnel" style={{ marginBottom: 12 }}>
            {(["2step", "1step"] as const).map((f) => (
              <label key={f} className={input.funnel === f ? "on" : ""}>
                <input type="radio" name="fc_funnel" checked={input.funnel === f} onChange={() => setAnswer("fc_funnel", f)} />
                {f === "2step" ? "2-Step Funnel" : "1-Step Funnel"}
                <span className="detail">{f === "2step" ? "Ad → opt-in → booking page → call. Standard for consultative service businesses." : "Ad → opt-in directly. Better for trades, quick quote calls (5-10 min)."}</span>
              </label>
            ))}
          </div>
        )}
        <div className="fc-grid">
          <div className="fc-panel">
            <div className="fc-head">
              Your inputs <span className="k-red">red</span> = below <span className="k-green">green</span> = on target <span className="k-gold">gold</span> = above
            </div>
            <FcRow id="fc_daily_budget" label="Daily Ad Budget" unit="currency" hint={B.dailyBudget.value.hint} />
            <FcRow id="fc_offer_price" label={checkout ? "Average order value" : "Offer Price"} unit="currency" extra={sitePrice ? <div><Tag kind="website" /> {sitePrice}</div> : undefined} />
            {google ? (
              <FcRow id="fc_cpc" label="Cost per click" unit="currency" term="cpc" extra={<CpcMarketHint />} />
            ) : (
              <>
                <FcRow id="fc_cpm" label="CPM" unit="currency" term="cpm" hint={`${B.cpmB2C.value.hint} / ${B.cpmB2B.value.hint}`} colour={colours.cpm} />
                <FcRow id="fc_ctr" label="Link CTR" unit="percent" term="ctr" hint={B.ctr.value.hint} colour={colours.ctr} />
              </>
            )}
            {checkout ? (
              <FcRow id="fc_purchase" label="Purchase Rate" unit="percent" />
            ) : (
              <>
                <FcRow id="fc_optin" label="Opt-in Rate" unit="percent" term="optin" hint={B.optin.value.hint} colour={colours.optin} />
                {input.funnel === "2step" && <FcRow id="fc_booking" label="Booking Rate" unit="percent" term="booking" hint={B.booking.value.hint} colour={colours.booking} />}
                <FcRow id="fc_show" label="Show Rate" unit="percent" term="show" hint={B.show.value.hint} colour={colours.show} />
                <FcRow id="fc_close" label="Close Rate" unit="percent" term="close" hint={B.close.value.hint} colour={colours.close} />
              </>
            )}
            <FcRow id="fc_margin" label="What you keep after costs" unit="percent" hint="New: for gross profit" />
          </div>
          <ForecastTable input={input} />
        </div>
        <div className="note teal" style={{ margin: "12px 0 0" }}>
          ROAS is a vanity metric. A 3x ROAS at $20k/day beats a 20x at $50/day. Net profit is what matters.
        </div>
      </Panel>

      <div className="panel-row">
        <div className="card">
          <div className="chip teal">Biggest dial</div>
          {dials.length > 0 ? (
            <>
              <div className="small">
                Moving <strong>{dials[0].label}</strong> from {pct(dials[0].current)} to the benchmark midpoint of {pct(dials[0].target)} adds about <strong>{money(dials[0].revenueGain)}</strong> a month.
                <Working formula={dials[0].formula} />
              </div>
              <div className="tiny muted">
                {dials
                  .slice(1)
                  .map((d) => `${d.label} ${d.revenueGain > 0 ? `+${money(d.revenueGain)}` : "at target"}`)
                  .join(" · ")}
              </div>
              <button
                type="button"
                className="btn small assist-btn"
                style={{ marginTop: 8 }}
                disabled={!!busy}
                onClick={async () => {
                  const r = await run("explain_forecast", "fc_explain");
                  if (r) setExplain(r);
                }}
              >
                Explain my forecast
              </button>
              {busy && <div className="loading">{busy}</div>}
              {error && <div className="error">{error}</div>}
              {explain && <ResultView action="explain_forecast" run={explain} onClose={() => setExplain(null)} />}
            </>
          ) : (
            <p className="small muted">Fill in every rate to see which dial moves revenue most.</p>
          )}
        </div>
        <div className="card">
          <div className="chip gold">Work backwards</div>
          <div className="fc-panel">
            <FcRow id="fc_revenue_goal" label="Monthly revenue goal" unit="currency" />
            <FcRow id="fc_weekly_capacity" label="Sales calls a week (optional)" unit="number" />
          </div>
          {back && back.dailyBudget !== null && (
            <div className="small" style={{ marginTop: 8 }}>
              Daily budget needed: <strong>{money(back.dailyBudget, 2)}</strong>
              <Working formula={back.formula + (back.capacityPerMonth ? ". Capacity a month = calls a week x 30.4 / 7" : "")} />
              {back.cappedByCapacity && <span className="fail"> Your call capacity caps this at {money(back.cappedDailyBudget, 2)} a day.</span>}
            </div>
          )}
          {goal && back?.dailyBudget === null && <p className="small muted">Fill in every rate first.</p>}
        </div>
      </div>
      {pack.software && <SoftwareFunnel />}
    </>
  );
}

function SoftwareFunnel() {
  const { answers, setAnswer, ws } = useStore();
  const archetype = (ws?.software_archetype as "self_serve" | "sales_led") || (answers.fc_sw_archetype as "self_serve" | "sales_led") || "self_serve";
  const input = useForecastInputs();
  const base = forecast(input);
  const def = ARCHETYPE_STAGES[archetype];
  const entry = archetype === "self_serve" ? (base.byKey.clicks?.monthly ?? null) : (base.byKey.leads?.monthly ?? null);
  const rates = Object.fromEntries(def.stages.map((s) => [s.key, num(answers[`fc_sw_${s.key}`])]));
  const r = softwareForecast(archetype, input.dailyBudget, entry, rates, num(answers.fc_sw_arpa));
  const money = useMoney();
  return (
    <div className="card navy">
      <div className="chip teal">Software funnel</div>
      <h3 className="sr-only">Software funnel</h3>
      <div className="choice two" style={{ marginBottom: 12 }}>
        {(["self_serve", "sales_led"] as const).map((a) => (
          <label key={a} className={archetype === a ? "on" : ""}>
            <input type="radio" checked={archetype === a} onChange={() => setAnswer("fc_sw_archetype", a)} />
            {a === "self_serve" ? "Self serve" : "Sales led"}
            <span className="detail">{a === "self_serve" ? "Visitors, signups, activated, paid" : "Leads, qualified, meetings, opportunities, won"}</span>
          </label>
        ))}
      </div>
      <div className="fc-grid">
        <div className="fc-panel">
          {def.stages.map((s) => (
            <FcRow key={s.key} id={`fc_sw_${s.key}`} label={s.rateLabel} unit="percent" />
          ))}
          <FcRow id="fc_sw_arpa" label="Monthly revenue per account" unit="currency" />
        </div>
        <div className="fc-panel">
          <table className="fc-out">
            <tbody>
              {r.lines.map((l) => (
                <tr key={l.key}>
                  <td>
                    {l.label}
                    <Working formula={l.formula} />
                  </td>
                  <td className="num">{l.monthly === null ? "" : l.monthly.toFixed(1)}</td>
                  <td className="num cost">{formatCostEach(l.costEach, ws?.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {r.newMrr !== null && (
        <p className="small" style={{ marginTop: 8 }}>
          New monthly recurring revenue: <strong>{money(r.newMrr)}</strong>. Payback and lifetime value are in My Plan.
        </p>
      )}
      <p className="tiny muted">No software benchmarks are shown yet. Hints appear once the benchmark table is added with its sources.</p>
    </div>
  );
}
