import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RecipeId } from "@pmw/engine";
import { api, ApiError } from "../lib/api.ts";
import { useStore } from "../lib/store.tsx";
import { Link } from "react-router-dom";

const BUTTON_LABEL: Record<RecipeId, string> = {
  site_scan: "Scan my website",
  search_demand: "Check with search data",
  customer_language: "Find how customers really talk",
  competitor_messages: "What competitors say",
  ads_running: "See what's already running",
  buyer_questions: "Find real questions",
  keyword_plan: "Find keywords",
};

/** Every research card carries its source: a link when there is one, otherwise a label (such as search data). */
export interface SourceRef {
  label?: string;
  title?: string;
  url: string | null;
  date?: string;
  kind?: string;
}

export const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
};

export function SourceLink({ source }: { source?: SourceRef | null }) {
  if (!source) return null;
  const label = source.label || source.title || (source.url ? hostOf(source.url) : "Source");
  return (
    <span className="tiny muted">
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer nofollow">
          {label}
        </a>
      ) : (
        label
      )}
      {source.date ? `, ${source.date.slice(0, 10)}` : ""}
    </span>
  );
}

export interface ResearchRun {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  step: string | null;
  result: any;
  sources: SourceRef[];
  error: string | null;
  started_at?: string;
  finished_at?: string | null;
}

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void };
  }
}

/** Cloudflare Turnstile widget. Loads its script only when needed. */
export function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const { config } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!config?.turnstileSiteKey || !ref.current) return;
    let widget: string | null = null;
    const mount = () => {
      if (ref.current && window.turnstile) widget = window.turnstile.render(ref.current, { sitekey: config.turnstileSiteKey, callback: onToken });
    };
    if (window.turnstile) mount();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.onload = mount;
      document.head.appendChild(s);
    }
    return () => {
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [config?.turnstileSiteKey, onToken]);
  return <div ref={ref} />;
}

export function useResearch(recipe: RecipeId) {
  const { ws, me } = useStore();
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [needsTurnstile, setNeedsTurnstile] = useState(false);
  const poll = useRef<number | null>(null);

  useEffect(() => {
    if (!ws) return;
    api
      .get<{ run: ResearchRun | null }>(`/api/research/latest?workspace_id=${ws.id}&recipe=${recipe}`)
      .then((r) => r.run && setRun(r.run))
      .catch(() => undefined);
    return () => {
      if (poll.current) window.clearTimeout(poll.current);
    };
  }, [ws?.id, recipe]);

  const watch = (id: string) => {
    const tick = async () => {
      try {
        const r = await api.get<ResearchRun>(`/api/research/runs/${id}`);
        setRun(r);
        if (r.status === "queued" || r.status === "running") poll.current = window.setTimeout(tick, 2000);
      } catch {
        poll.current = window.setTimeout(tick, 4000);
      }
    };
    void tick();
  };

  const start = async (params?: Record<string, unknown>, turnstileToken?: string) => {
    if (!ws) return;
    setError(null);
    try {
      const r = await api.post<{ run_id: string }>(`/api/research/${recipe}`, { workspace_id: ws.id, params, turnstile_token: turnstileToken });
      setNeedsTurnstile(false);
      setRun({ id: r.run_id, status: "queued", step: "Starting", result: null, sources: [], error: null });
      watch(r.run_id);
    } catch (e) {
      const err = e instanceof ApiError ? { code: e.code, message: e.message } : { code: "error", message: "That didn't work. Try again." };
      if (err.code === "turnstile") setNeedsTurnstile(true);
      setError(err);
    }
  };

  return { run, start, error, needsTurnstile, saved: !!me?.user.saved, running: run?.status === "queued" || run?.status === "running" };
}

export function Sources({ sources, date }: { sources: SourceRef[]; date?: string | null }) {
  if (!sources?.length) return null;
  const unique = sources.filter((s, i) => sources.findIndex((x) => (x.url ?? x.label) === (s.url ?? s.label)) === i);
  return (
    <div className="tiny muted" style={{ marginTop: 6 }}>
      Sources:{" "}
      {unique.slice(0, 8).map((s, i) => (
        <span key={i}>
          {i > 0 && "; "}
          <SourceLink source={{ ...s, date: undefined }} />
        </span>
      ))}
      {date && <> · checked {date.slice(0, 10)}</>}
    </div>
  );
}

/** Research gate and runner. Children render the result. */
export function ResearchPanel({ recipe, params, children, label }: { recipe: RecipeId; params?: Record<string, unknown>; children?: (run: ResearchRun) => ReactNode; label?: string }) {
  const { config, site } = useStore();
  const r = useResearch(recipe);
  if (!config?.researchEnabled) return null;
  const scanned = site?.status === "confirmed" || site?.status === "no_website";
  const locked = !scanned ? (
    <span className="tiny muted">
      Unlocks once your website scan is confirmed. <Link to="/onboarding?step=scan">Finish that step</Link>
    </span>
  ) : !r.saved ? (
    <span className="tiny muted">
      Add your email to use market research. <Link to="/save">Save my work</Link>
    </span>
  ) : null;
  return (
    <div className="market-bar">
      <span className="tag market">Market data</span>
      <button type="button" className="btn small" disabled={r.running || !scanned || !r.saved} onClick={() => r.start(params)}>
        {label ?? BUTTON_LABEL[recipe]}
      </button>
      {locked}
      {r.running && <span className="loading">{r.run?.step ?? "Working on it"}...</span>}
      {r.needsTurnstile && <Turnstile onToken={(t) => r.start(params, t)} />}
      {r.error && r.error.code !== "turnstile" && <span className="error">{r.error.message}</span>}
      {r.run?.status === "failed" && <span className="error">That research didn't finish. {r.run.error ?? "Try again later."}</span>}
      {r.run?.status === "done" && r.run.result && (
        <div className="market-result">
          {site?.status === "no_website" && <p className="tiny muted">Based on your description, not your website.</p>}
          {children ? children(r.run) : <GenericResult result={r.run.result} />}
          <Sources sources={r.run.sources} date={r.run.finished_at ?? r.run.started_at} />
        </div>
      )}
    </div>
  );
}

export function ResearchButton({ recipe }: { recipe: RecipeId }) {
  const { answers, setAnswer } = useStore();
  if (recipe === "buyer_questions")
    return (
      <ResearchPanel recipe={recipe}>
        {(r) => {
          const top = (r.result.top ?? []) as { question: string; source: SourceRef }[];
          return (
            <div>
              <ol className="small" style={{ paddingLeft: 18 }}>
                {top.map((q, i) => (
                  <li key={i}>
                    {q.question} <SourceLink source={q.source} />
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  const current = String(answers.vsl_faq ?? "").trim();
                  setAnswer("vsl_faq", [current, ...top.map((q) => `Q: ${q.question}\nA: [your answer]`)].filter(Boolean).join("\n\n"), { origin: "suggestion", runId: r.id });
                }}
              >
                Add these to my FAQ
              </button>
            </div>
          );
        }}
      </ResearchPanel>
    );
  return <ResearchPanel recipe={recipe} />;
}

/** Fallback renderer: lists any array of items with their source links. */
export function GenericResult({ result }: { result: any }) {
  if (!result || typeof result !== "object") return null;
  return (
    <div>
      {Object.entries(result).map(([k, v]) => {
        if (Array.isArray(v) && v.length && typeof v[0] === "object")
          return (
            <ul key={k} className="small" style={{ paddingLeft: 18 }}>
              {(v as Record<string, any>[]).map((item, i) => {
                const text = item.phrase ?? item.question ?? item.headline ?? item.keyword ?? item.angle ?? item.text ?? item.title ?? JSON.stringify(item);
                const src = item.source ?? item.url ?? item.source_url;
                const url = typeof src === "string" ? src : src?.url;
                return (
                  <li key={i}>
                    {String(text)}
                    {item.type && <span className="tag" style={{ marginLeft: 6 }}>{item.type}</span>}
                    {url && (
                      <>
                        {" "}
                        <a className="tiny" href={url} target="_blank" rel="noopener noreferrer nofollow">
                          source
                        </a>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          );
        if (typeof v === "string" || typeof v === "number")
          return (
            <p key={k} className="small">
              {String(v)}
            </p>
          );
        return null;
      })}
    </div>
  );
}
