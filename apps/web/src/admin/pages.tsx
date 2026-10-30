import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ACTION_SPEC, INDUSTRY_PACKS, MODELS, SECTIONS, formatMoney, packByKey, sectionById } from "@pmw/engine";
import { useAdmin } from "./Admin.tsx";

// ---------- Small helpers ----------

const usd = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "" : formatMoney(v, "USD", Math.abs(v) < 1 && v !== 0 ? 4 : d));
const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : Number(v).toLocaleString("en-AU"));
const when = (s: string | null | undefined) => (s ? s.replace("T", " ").slice(0, 16) : "");
const pctOf = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "");

const RECIPES = ["site_scan", "search_demand", "customer_language", "competitor_messages", "ads_running", "buyer_questions", "keyword_plan"];

const EVENT_LABELS: Record<string, string> = {
  section_viewed: "Viewed a section",
  section_completed: "Finished a section",
  checklist_ticked: "Ticked a checklist item",
  onboarding_step: "Moved through onboarding",
  onboarding_completed: "Finished onboarding",
  assist_requested: "Asked for writing help",
  assist_used: "Used a suggestion",
  assist_rated: "Rated a suggestion",
  research_started: "Started research",
  research_completed: "Research finished",
  research_failed: "Research failed",
  prelaunch_ready: "Ready to launch",
  export_pdf: "Exported a PDF",
  export_csv: "Exported a CSV",
  scenario_created: "Made a what-if scenario",
  email_saved: "Saved their email",
};

function Loading({ error }: { error: string | null }) {
  return error ? <div className="note warn">{error}</div> : <div className="muted">Loading...</div>;
}

function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {sub && <div className="tiny muted">{sub}</div>}
    </div>
  );
}

function Bar({ value, max, label }: { value: number; max: number; label?: ReactNode }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 6, height: 12, overflow: "hidden" }}>
        <div style={{ width: `${w}%`, height: "100%", background: "var(--brand)" }} />
      </div>
      <span className="tiny" style={{ minWidth: 60, textAlign: "right" }}>
        {label ?? n(value)}
      </span>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="small" style={{ display: "grid", gap: 4 }}>
      {label}
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Filters({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 12 }}>{children}</div>;
}

const industryOptions: [string, string][] = INDUSTRY_PACKS.map((p) => [p.key, p.label]);
const sectionTitle = (id: string | null | undefined) => (id ? (sectionById(id)?.title ?? id) : "");

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="muted">none</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return <span>{String(value)}</span>;
  return <pre className="json">{JSON.stringify(value, null, 2)}</pre>;
}

// ---------- Overview ----------

interface OverviewData {
  users: number;
  savedUsers: number;
  workspaces: number;
  onboarded: number;
  activeLast7: number;
  assists: number;
  researchRuns: number;
  monthToDate: { claudeCostUsd: number; budgetUsd: number; webSearches: number; ahrefsUnitsToday: number; ahrefsDailyCap: number };
  spendSeries: { day: string; claude_cost_usd: number; web_searches: number; ahrefs_units: number }[];
  industries: { industry: string; n: number }[];
}

export function Overview() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, error } = useAdmin<OverviewData>("/overview", { from: from || undefined, to: to || undefined });
  if (!data) return <Loading error={error} />;
  const m = data.monthToDate;
  const series = [...data.spendSeries].reverse();
  const maxCost = Math.max(0, ...series.map((s) => s.claude_cost_usd));
  const maxInd = Math.max(0, ...data.industries.map((i) => i.n));
  return (
    <div>
      <h1>Overview</h1>
      <Filters>
        <label className="small" style={{ display: "grid", gap: 4 }}>
          From
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="small" style={{ display: "grid", gap: 4 }}>
          To
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </Filters>
      <div className="kpi-row">
        <Kpi label="Visitors" value={n(data.users)} sub={`${n(data.savedUsers)} saved an email`} />
        <Kpi label="Workspaces" value={n(data.workspaces)} sub={`${n(data.onboarded)} finished onboarding`} />
        <Kpi label="Active last 7 days" value={n(data.activeLast7)} />
        <Kpi label="Writing help runs" value={n(data.assists)} sub={`${n(data.researchRuns)} research runs`} />
      </div>
      <h2>Spend this month</h2>
      <div className="kpi-row">
        <Kpi label="Writing and research cost" value={usd(m.claudeCostUsd)} sub={`of ${usd(m.budgetUsd)} budget (${pctOf(m.claudeCostUsd, m.budgetUsd)})`} />
        <Kpi label="Web searches" value={n(m.webSearches)} />
        <Kpi label="Market data units today" value={n(m.ahrefsUnitsToday)} sub={`of ${n(m.ahrefsDailyCap)} daily cap`} />
      </div>
      <div className="card">
        <h3>Daily cost (last 60 days)</h3>
        {series.length === 0 && <p className="small muted">No spend recorded yet.</p>}
        {series.map((s) => (
          <div key={s.day} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, alignItems: "center" }}>
            <span className="tiny muted">{s.day}</span>
            <Bar value={s.claude_cost_usd} max={maxCost} label={`${usd(s.claude_cost_usd)} · ${n(s.ahrefs_units)} units`} />
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Workspaces by industry</h3>
        {data.industries.map((i) => (
          <div key={i.industry} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 200px) 1fr", gap: 8, alignItems: "center" }}>
            <span className="small">{i.industry === "(not set)" ? "Not set" : packByKey(i.industry).label}</span>
            <Bar value={i.n} max={maxInd} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Activity ----------

interface ActivityEvent {
  id: number;
  type: string;
  data: Record<string, unknown>;
  created_at: string;
  workspace_id: string | null;
  company: string | null;
  name: string | null;
  email: string | null;
}

function describe(e: ActivityEvent): string {
  const d = e.data ?? {};
  if (d.section) return sectionTitle(String(d.section));
  if (d.field_id) return String(d.field_id) + (d.action ? ` (${d.action})` : "");
  if (d.step !== undefined) return `Step ${d.step}`;
  if (d.recipe) return String(d.recipe);
  return "";
}

export function Activity() {
  const { data, error } = useAdmin<{ events: ActivityEvent[] }>("/activity", { limit: "200" }, 20_000);
  if (!data) return <Loading error={error} />;
  return (
    <div>
      <h1>Activity</h1>
      <p className="small muted">What people are doing right now. Refreshes every 20 seconds.</p>
      <Table head={["When", "Who", "What", "Detail"]}>
        {data.events.map((e) => (
          <tr key={e.id}>
            <td className="small" style={{ whiteSpace: "nowrap" }}>
              {when(e.created_at)}
            </td>
            <td className="small">
              {e.workspace_id ? <Link to={`/admin/workspaces/${e.workspace_id}`}>{e.company || e.name || e.workspace_id}</Link> : "Visitor"}
              {e.email && <div className="tiny muted">{e.email}</div>}
            </td>
            <td className="small">{EVENT_LABELS[e.type] ?? e.type}</td>
            <td className="small muted">{describe(e)}</td>
          </tr>
        ))}
      </Table>
      {data.events.length === 0 && <p className="small muted">Nothing yet.</p>}
    </div>
  );
}

// ---------- Funnel ----------

interface FunnelData {
  started: number;
  onboarded: number;
  onboardingSteps: Record<string, number>;
  sections: { id: string; number: number; title: string; completed: number }[];
}

const ONBOARDING_STEPS = ["Consent", "Business", "Industry", "Offer", "Where", "Goal", "Spend", "Scan check", "Done"];

export function Funnel() {
  const [industry, setIndustry] = useState("");
  const [channel, setChannel] = useState("");
  const { data, error } = useAdmin<FunnelData>("/funnel", { industry: industry || undefined, channel: channel || undefined });
  return (
    <div>
      <h1>Funnel</h1>
      <Filters>
        <Select label="Industry" value={industry} onChange={setIndustry} options={industryOptions} />
        <Select label="Channel" value={channel} onChange={setChannel} options={[["meta", "Meta"], ["google", "Google"]]} />
      </Filters>
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="kpi-row">
            <Kpi label="Started" value={n(data.started)} />
            <Kpi label="Finished onboarding" value={n(data.onboarded)} sub={pctOf(data.onboarded, data.started)} />
          </div>
          <div className="card">
            <h3>Where people are in onboarding</h3>
            {Object.entries(data.onboardingSteps)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([step, count]) => (
                <div key={step} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
                  <span className="small">{ONBOARDING_STEPS[Number(step)] ?? `Step ${step}`}</span>
                  <Bar value={count} max={data.started} />
                </div>
              ))}
          </div>
          <div className="card">
            <h3>Sections finished</h3>
            {data.sections.map((s) => (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 220px) 1fr", gap: 8, alignItems: "center" }}>
                <span className="small">
                  {s.number}. {s.title}
                </span>
                <Bar value={s.completed} max={data.started} label={`${n(s.completed)} (${pctOf(s.completed, data.started) || "0%"})`} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Workspaces ----------

interface WsRow {
  id: string;
  name: string;
  company: string | null;
  website: string | null;
  industry_pack: string | null;
  channel: string | null;
  funnel_type: string | null;
  service_city: string | null;
  onboarding_done_at: string | null;
  created_at: string;
  updated_at: string;
  email: string | null;
  answer_count: number;
  assist_count: number;
  completed: number;
}

export function Workspaces() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const { data, error } = useAdmin<{ workspaces: WsRow[] }>("/workspaces", { q: search || undefined, limit: String(limit), offset: String(offset) });
  return (
    <div>
      <h1>Workspaces</h1>
      <form
        className="input-row"
        style={{ marginBottom: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setSearch(q.trim());
        }}
      >
        <label className="sr-only" htmlFor="ws-search">
          Search
        </label>
        <input id="ws-search" className="input" placeholder="Search business, email or website" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn">
          Search
        </button>
      </form>
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <Table head={["Business", "Email", "Industry", "Channel", "Sections done", "Answers", "Help runs", "Last active"]}>
            {data.workspaces.map((w) => (
              <tr key={w.id}>
                <td>
                  <Link to={`/admin/workspaces/${w.id}`}>{w.company || w.name}</Link>
                  {w.website && <div className="tiny muted">{w.website}</div>}
                  {!w.onboarding_done_at && <span className="tag">Onboarding</span>}
                </td>
                <td className="small">{w.email ?? <span className="muted">not saved</span>}</td>
                <td className="small">{w.industry_pack ? packByKey(w.industry_pack).label : ""}</td>
                <td className="small">{w.channel ?? ""}</td>
                <td className="num">
                  {w.completed} of {SECTIONS.length}
                </td>
                <td className="num">{n(w.answer_count)}</td>
                <td className="num">{n(w.assist_count)}</td>
                <td className="small" style={{ whiteSpace: "nowrap" }}>
                  {when(w.updated_at)}
                </td>
              </tr>
            ))}
          </Table>
          {data.workspaces.length === 0 && <p className="small muted">No workspaces found.</p>}
          <div className="btn-row">
            <button type="button" className="btn small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
              Previous
            </button>
            <button type="button" className="btn small" disabled={data.workspaces.length < limit} onClick={() => setOffset(offset + limit)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Workspace detail ----------

interface DetailData {
  workspace: Record<string, any> & { completed_sections: string[] };
  answers: { module: string; field_id: string; updated_at: string; value: unknown; origin: string }[];
  site: (Record<string, any> & { profile: any; tracking: any; ahrefs: any; pages: any }) | null;
  assists: { id: string; section: string | null; field_id: string; action: string; model: string; cost_usd: number; latency_ms: number | null; output: unknown; used: number; rating: number | null; error: string | null; created_at: string }[];
  research: { id: string; recipe: string; status: string; step: string | null; result: unknown; sources: { url: string; title?: string }[]; params: unknown; web_searches: number; ahrefs_units: number; cost_usd: number; error: string | null; started_at: string; finished_at: string | null }[];
  events: { type: string; data: Record<string, unknown>; created_at: string }[];
  scenarios: { name: string; overrides_json: string; updated_at: string }[];
}

const ORIGIN_TAG: Record<string, [string, string]> = {
  suggestion: ["suggestion", "Suggestion"],
  edited_suggestion: ["suggestion", "Edited suggestion"],
};

function Section({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="card" open={open}>
      <summary style={{ cursor: "pointer" }}>
        <strong>{title}</strong>
      </summary>
      <div style={{ marginTop: 10 }}>{children}</div>
    </details>
  );
}

export function WorkspaceDetail() {
  const { id } = useParams();
  const { data, error } = useAdmin<DetailData>(`/workspaces/${encodeURIComponent(id ?? "")}`);
  if (!data) return <Loading error={error} />;
  const w = data.workspace;
  const byModule = new Map<string, DetailData["answers"]>();
  for (const a of data.answers) byModule.set(a.module, [...(byModule.get(a.module) ?? []), a]);
  const assistCost = data.assists.reduce((s, a) => s + (a.cost_usd ?? 0), 0);
  return (
    <div>
      <p className="small">
        <Link to="/admin/workspaces">Back to workspaces</Link>
      </p>
      <h1>{w.company || w.name}</h1>
      <p className="small muted">
        {w.email ?? "No email saved"} · {w.industry_pack ? packByKey(w.industry_pack).label : "No industry"} · {w.channel ?? "no channel yet"} · {w.funnel_type ?? "no funnel yet"} · created {when(w.created_at)}
      </p>
      <div className="kpi-row">
        <Kpi label="Sections done" value={`${w.completed_sections.length} of ${SECTIONS.length}`} />
        <Kpi label="Answers" value={n(data.answers.length)} />
        <Kpi label="Help runs" value={n(data.assists.length)} sub={`${n(data.assists.filter((a) => a.used).length)} used`} />
        <Kpi label="Writing help cost" value={usd(assistCost)} />
      </div>

      <Section title="Business details">
        <Table head={["Field", "Value"]}>
          {["website", "offer_line", "service_city", "country", "currency", "audience_type", "sell_mode", "goal", "current_spend", "tracking_status", "onboarding_done_at", "last_section"].map((k) => (
            <tr key={k}>
              <td className="small">{k}</td>
              <td className="small">{w[k] === null || w[k] === undefined || w[k] === "" ? <span className="muted">none</span> : String(w[k])}</td>
            </tr>
          ))}
        </Table>
        <p className="small">Finished: {w.completed_sections.map(sectionTitle).join(", ") || "none yet"}</p>
      </Section>

      <Section title="Website scan" open={!!data.site}>
        {!data.site ? (
          <p className="small muted">No scan.</p>
        ) : (
          <>
            <p className="small">
              {data.site.domain ?? "No domain"} · <span className="tag">{data.site.status}</span> · scanned {when(data.site.scanned_at)} {data.site.confirmed_at && `· confirmed ${when(data.site.confirmed_at)}`}
            </p>
            {data.site.error && <div className="note warn small">{data.site.error}</div>}
            <h3>Profile</h3>
            <Json value={data.site.profile} />
            <h3>Tracking found</h3>
            <Json value={data.site.tracking} />
            <h3>Market data</h3>
            <Json value={data.site.ahrefs} />
          </>
        )}
      </Section>

      <Section title={`Answers (${data.answers.length})`}>
        {[...byModule.entries()].map(([mod, rows]) => (
          <div key={mod} style={{ marginBottom: 12 }}>
            <h3>{sectionTitle(mod) || mod}</h3>
            <Table head={["Field", "Answer", "Origin", "Updated"]}>
              {rows.map((a) => (
                <tr key={a.field_id}>
                  <td className="small">{a.field_id}</td>
                  <td className="small" style={{ maxWidth: 480 }}>
                    <Json value={a.value} />
                  </td>
                  <td>{ORIGIN_TAG[a.origin] ? <span className={`tag ${ORIGIN_TAG[a.origin][0]}`}>{ORIGIN_TAG[a.origin][1]}</span> : <span className="tag">Typed</span>}</td>
                  <td className="tiny" style={{ whiteSpace: "nowrap" }}>
                    {when(a.updated_at)}
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        ))}
        {data.answers.length === 0 && <p className="small muted">No answers yet.</p>}
      </Section>

      <Section title={`Writing help timeline (${data.assists.length})`}>
        <Table head={["When", "Field", "Button", "Suggested", "Used", "Rating", "Cost"]}>
          {data.assists.map((a) => (
            <tr key={a.id}>
              <td className="tiny" style={{ whiteSpace: "nowrap" }}>
                {when(a.created_at)}
              </td>
              <td className="small">
                {a.field_id}
                <div className="tiny muted">{sectionTitle(a.section)}</div>
              </td>
              <td className="small">{ACTION_SPEC[a.action as keyof typeof ACTION_SPEC]?.label ?? a.action}</td>
              <td className="small" style={{ maxWidth: 420 }}>
                {a.error ? <span className="fail">Failed: {a.error}</span> : <Json value={a.output} />}
              </td>
              <td>{a.used ? <span className="tag green">Used</span> : <span className="tag">No</span>}</td>
              <td>{a.rating === 1 ? "👍" : a.rating === -1 ? "👎" : ""}</td>
              <td className="num">
                {usd(a.cost_usd)}
                <div className="tiny muted">{a.model}</div>
              </td>
            </tr>
          ))}
        </Table>
        {data.assists.length === 0 && <p className="small muted">No writing help used.</p>}
      </Section>

      <Section title={`Research runs (${data.research.length})`}>
        {data.research.map((r) => (
          <div key={r.id} className="card" style={{ boxShadow: "none" }}>
            <p className="small" style={{ margin: 0 }}>
              <strong>{r.recipe}</strong> <span className={`tag ${r.status === "failed" ? "red" : r.status === "done" ? "green" : ""}`}>{r.status}</span> · {when(r.started_at)} · {usd(r.cost_usd)} · {n(r.ahrefs_units)} units · {n(r.web_searches)} searches
            </p>
            {r.error && <div className="small fail">{r.error}</div>}
            <details>
              <summary className="small">Result</summary>
              <Json value={r.result} />
              <h3 className="small">Inputs</h3>
              <Json value={r.params} />
            </details>
            {r.sources.length > 0 && (
              <ul className="tiny" style={{ paddingLeft: 18 }}>
                {r.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {data.research.length === 0 && <p className="small muted">No research runs.</p>}
      </Section>

      <Section title={`Scenarios (${data.scenarios.length})`} open={false}>
        {data.scenarios.map((s, i) => (
          <div key={i} className="small" style={{ marginBottom: 8 }}>
            <strong>{s.name}</strong> <span className="tiny muted">{when(s.updated_at)}</span>
            <pre className="json">{s.overrides_json}</pre>
          </div>
        ))}
        {data.scenarios.length === 0 && <p className="small muted">No scenarios.</p>}
      </Section>

      <Section title={`Events (${data.events.length})`} open={false}>
        <Table head={["When", "What", "Detail"]}>
          {data.events.map((e, i) => (
            <tr key={i}>
              <td className="tiny" style={{ whiteSpace: "nowrap" }}>
                {when(e.created_at)}
              </td>
              <td className="small">{EVENT_LABELS[e.type] ?? e.type}</td>
              <td className="small muted">{Object.keys(e.data ?? {}).length ? JSON.stringify(e.data) : ""}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}

// ---------- Assists ----------

interface AssistsData {
  byAction: { action: string; runs: number; used: number; up: number; down: number; cost: number; errors: number }[];
  bySection: { section: string | null; runs: number; used: number }[];
  ignored: { field_id: string; runs: number; used: number; ignore_rate: number }[];
  models: { model: string; runs: number; cost: number; avg_ms: number }[];
  costPerCompletedWorkbook: number | null;
  completedWorkbooks: number;
  recent: { id: string; workspace_id: string; field_id: string; action: string; model: string; used: number; rating: number | null; cost_usd: number; error: string | null; created_at: string }[];
}

export function Assists() {
  const [action, setAction] = useState("");
  const [section, setSection] = useState("");
  const [model, setModel] = useState("");
  const [industry, setIndustry] = useState("");
  const { data, error } = useAdmin<AssistsData>("/assists", { action: action || undefined, section: section || undefined, model: model || undefined, industry: industry || undefined });
  const actionLabel = (a: string) => ACTION_SPEC[a as keyof typeof ACTION_SPEC]?.label ?? a;
  return (
    <div>
      <h1>Writing help</h1>
      <Filters>
        <Select label="Button" value={action} onChange={setAction} options={Object.entries(ACTION_SPEC).map(([k, v]) => [k, v.label])} />
        <Select label="Section" value={section} onChange={setSection} options={SECTIONS.map((s) => [s.id, s.title])} />
        <Select label="Model" value={model} onChange={setModel} options={Object.keys(MODELS).map((m) => [m, m])} />
        <Select label="Industry" value={industry} onChange={setIndustry} options={industryOptions} />
      </Filters>
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="kpi-row">
            <Kpi label="Runs" value={n(data.byAction.reduce((s, a) => s + a.runs, 0))} />
            <Kpi label="Use rate" value={pctOf(data.byAction.reduce((s, a) => s + (a.used ?? 0), 0), data.byAction.reduce((s, a) => s + a.runs, 0)) || "0%"} />
            <Kpi label="Cost per completed workbook" value={data.costPerCompletedWorkbook === null ? "none yet" : usd(data.costPerCompletedWorkbook)} sub={`${n(data.completedWorkbooks)} completed`} />
          </div>
          <h2>By button</h2>
          <Table head={["Button", "Runs", "Used", "Use rate", "👍", "👎", "Errors", "Cost"]}>
            {data.byAction.map((a) => (
              <tr key={a.action}>
                <td>{actionLabel(a.action)}</td>
                <td className="num">{n(a.runs)}</td>
                <td className="num">{n(a.used)}</td>
                <td className="num">{pctOf(a.used ?? 0, a.runs)}</td>
                <td className="num">{n(a.up)}</td>
                <td className="num">{n(a.down)}</td>
                <td className="num">{n(a.errors)}</td>
                <td className="num">{usd(a.cost)}</td>
              </tr>
            ))}
          </Table>
          <h2>By section</h2>
          <Table head={["Section", "Runs", "Used", "Use rate"]}>
            {data.bySection.map((s) => (
              <tr key={s.section ?? "none"}>
                <td>{sectionTitle(s.section) || "Other"}</td>
                <td className="num">{n(s.runs)}</td>
                <td className="num">{n(s.used)}</td>
                <td className="num">{pctOf(s.used ?? 0, s.runs)}</td>
              </tr>
            ))}
          </Table>
          <h2>Suggestions most often ignored</h2>
          <p className="small muted">Fields with 3 or more runs.</p>
          <Table head={["Field", "Runs", "Used", "Ignored"]}>
            {data.ignored.map((f) => (
              <tr key={f.field_id}>
                <td>{f.field_id}</td>
                <td className="num">{n(f.runs)}</td>
                <td className="num">{n(f.used)}</td>
                <td className="num">{Math.round((f.ignore_rate ?? 0) * 100)}%</td>
              </tr>
            ))}
          </Table>
          <h2>Model mix</h2>
          <Table head={["Model", "Runs", "Cost", "Average time"]}>
            {data.models.map((m) => (
              <tr key={m.model}>
                <td>{m.model}</td>
                <td className="num">{n(m.runs)}</td>
                <td className="num">{usd(m.cost)}</td>
                <td className="num">{m.avg_ms ? `${(m.avg_ms / 1000).toFixed(1)}s` : ""}</td>
              </tr>
            ))}
          </Table>
          <h2>Recent</h2>
          <Table head={["When", "Workspace", "Field", "Button", "Used", "Rating", "Cost"]}>
            {data.recent.map((r) => (
              <tr key={r.id}>
                <td className="tiny" style={{ whiteSpace: "nowrap" }}>
                  {when(r.created_at)}
                </td>
                <td className="small">
                  <Link to={`/admin/workspaces/${r.workspace_id}`}>Open</Link>
                </td>
                <td className="small">{r.field_id}</td>
                <td className="small">
                  {actionLabel(r.action)}
                  {r.error && <div className="tiny fail">{r.error}</div>}
                </td>
                <td>{r.used ? <span className="tag green">Used</span> : ""}</td>
                <td>{r.rating === 1 ? "👍" : r.rating === -1 ? "👎" : ""}</td>
                <td className="num">{usd(r.cost_usd)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </div>
  );
}

// ---------- Research ----------

interface ResearchData {
  byRecipe: { recipe: string; runs: number; failures: number; avg_cost: number; units: number; cache_hits: number }[];
  unitsPerDay: { day: string; ahrefs_units: number }[];
  cache: { rows: number; units: number } | null;
  failures: { id: string; workspace_id: string; recipe: string; error: string | null; started_at: string }[];
}

export function Research() {
  const [recipe, setRecipe] = useState("");
  const [from, setFrom] = useState("");
  const { data, error } = useAdmin<ResearchData>("/research", { recipe: recipe || undefined, from: from || undefined });
  const days = data ? [...data.unitsPerDay].reverse() : [];
  const maxUnits = Math.max(0, ...days.map((d) => d.ahrefs_units));
  return (
    <div>
      <h1>Research</h1>
      <Filters>
        <Select label="Recipe" value={recipe} onChange={setRecipe} options={RECIPES.map((r) => [r, r])} />
        <label className="small" style={{ display: "grid", gap: 4 }}>
          From
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
      </Filters>
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <Table head={["Recipe", "Runs", "Failures", "Average cost", "Units", "Cache hits", "Cache hit rate"]}>
            {data.byRecipe.map((r) => (
              <tr key={r.recipe}>
                <td>{r.recipe}</td>
                <td className="num">{n(r.runs)}</td>
                <td className="num">{n(r.failures)}</td>
                <td className="num">{usd(r.avg_cost)}</td>
                <td className="num">{n(r.units)}</td>
                <td className="num">{n(r.cache_hits)}</td>
                <td className="num">{pctOf(r.cache_hits ?? 0, (r.cache_hits ?? 0) + (r.units > 0 ? r.runs : 0))}</td>
              </tr>
            ))}
          </Table>
          {data.byRecipe.length === 0 && <p className="small muted">No research runs yet.</p>}
          <p className="small muted">
            Cache: {n(data.cache?.rows ?? 0)} saved lookups worth {n(data.cache?.units ?? 0)} units.
          </p>
          <div className="card">
            <h3>Market data units per day</h3>
            {days.map((d) => (
              <div key={d.day} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, alignItems: "center" }}>
                <span className="tiny muted">{d.day}</span>
                <Bar value={d.ahrefs_units} max={maxUnits} />
              </div>
            ))}
            {days.length === 0 && <p className="small muted">No units used yet.</p>}
          </div>
          <h2>Recent failures</h2>
          <Table head={["When", "Recipe", "Workspace", "Error"]}>
            {data.failures.map((f) => (
              <tr key={f.id}>
                <td className="tiny" style={{ whiteSpace: "nowrap" }}>
                  {when(f.started_at)}
                </td>
                <td className="small">{f.recipe}</td>
                <td className="small">
                  <Link to={`/admin/workspaces/${f.workspace_id}`}>Open</Link>
                </td>
                <td className="small">{f.error}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </div>
  );
}

// ---------- Market insights ----------

interface InsightsData {
  insights: ({ industry: string } & Partial<Record<"pains" | "motivators" | "attempts", { text: string; count: number }[]>>)[];
  keywords: { keyword: string; volume: number | null; checked: string }[];
}

const KINDS: ["pains" | "motivators" | "attempts", string][] = [
  ["pains", "Top pains"],
  ["motivators", "Top motivators"],
  ["attempts", "Previous attempts"],
];

export function Insights() {
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const { data, error } = useAdmin<InsightsData>("/insights", { industry: industry || undefined, country: country || undefined });
  return (
    <div>
      <h1>Market insights</h1>
      <p className="small muted">Across every workspace: what customers want, what hurts, and what they've tried, by industry.</p>
      <Filters>
        <Select label="Industry" value={industry} onChange={setIndustry} options={industryOptions} />
        <Select label="Country" value={country} onChange={setCountry} options={[["AU", "Australia"], ["NZ", "New Zealand"], ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["IE", "Ireland"]]} />
      </Filters>
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          {data.insights.length === 0 && <p className="small muted">No avatar answers yet.</p>}
          {data.insights.map((ind) => (
            <div key={ind.industry} className="card">
              <h2>{ind.industry}</h2>
              <div className="cards">
                {KINDS.map(([k, label]) => (
                  <div key={k}>
                    <h3>{label}</h3>
                    <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
                      {(ind[k] ?? []).map((x, i) => (
                        <li key={i}>
                          {x.text} {x.count > 1 && <span className="tag">{x.count}</span>}
                        </li>
                      ))}
                    </ol>
                    {!(ind[k] ?? []).length && <p className="small muted">None yet.</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <h2>Keywords checked</h2>
          <Table head={["Keyword", "Monthly searches", "Checked"]}>
            {data.keywords.map((k) => (
              <tr key={k.keyword}>
                <td>{k.keyword}</td>
                <td className="num">{k.volume === null ? "no data" : n(k.volume)}</td>
                <td className="tiny">{when(k.checked)}</td>
              </tr>
            ))}
          </Table>
          {data.keywords.length === 0 && <p className="small muted">No keyword checks yet.</p>}
          <p className="tiny muted">Search volumes are market data from Ahrefs, as at the date checked.</p>
        </>
      )}
    </div>
  );
}
