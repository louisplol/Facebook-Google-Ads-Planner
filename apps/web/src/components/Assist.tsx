import { useState, type ReactNode } from "react";
import { ACTION_SPEC, type AssistAction } from "@pmw/engine";
import { postSse, api, ApiError } from "../lib/api.ts";
import { useStore } from "../lib/store.tsx";
import { Tag } from "./bits.tsx";

export interface AssistRun {
  runId: string;
  output: any;
  flags: { id: string; message: string }[];
}

/** Runs one assist on the server. Never touches the user's text; callers decide what to do with the result. */
export function useAssist() {
  const { ws, config } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const available = !!config?.assistEnabled;

  async function run(action: AssistAction, fieldId: string, text?: string, extra?: Record<string, unknown>): Promise<AssistRun | null> {
    if (!ws) return null;
    setBusy(ACTION_SPEC[action].loading);
    setError(null);
    let result: AssistRun | null = null;
    try {
      await postSse("/api/assist", { workspace_id: ws.id, field_id: fieldId, action, text, extra }, (e) => {
        if (e.event === "status") setBusy(e.data.message);
        if (e.event === "result") result = { runId: e.data.run_id, output: e.data.output, flags: e.data.flags ?? [] };
        if (e.event === "error") setError(e.data.message);
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
    return result;
  }

  return { run, busy, error, available, setError };
}

export function rate(runId: string, rating: 1 | -1) {
  void api.post(`/api/assist/${runId}/rate`, { rating }).catch(() => undefined);
}

function Thumbs({ runId }: { runId: string }) {
  const [done, setDone] = useState<0 | 1 | -1>(0);
  if (done) return <span className="tiny muted">Thanks</span>;
  return (
    <>
      <button type="button" className="btn ghost small" aria-label="Helpful" onClick={() => (rate(runId, 1), setDone(1))}>
        👍
      </button>
      <button type="button" className="btn ghost small" aria-label="Not helpful" onClick={() => (rate(runId, -1), setDone(-1))}>
        👎
      </button>
    </>
  );
}

export function Flags({ flags }: { flags: { id: string; message: string }[] }) {
  if (!flags.length) return null;
  return (
    <div className="note warn small">
      {flags.map((f) => (
        <div key={f.id}>{f.message}</div>
      ))}
    </div>
  );
}

/** Renders option cards with Use this / Edit, then use / Try again. */
export function OptionCards({ run, onUse, onEdit, onRetry, onClose }: { run: AssistRun; onUse: (text: string) => void; onEdit?: (text: string) => void; onRetry?: () => void; onClose: () => void }) {
  const options = (run.output.options ?? []) as { text: string; note: string; from: string }[];
  return (
    <div className="assist-cards">
      <Flags flags={run.flags} />
      {options.map((o, i) => (
        <div className="assist-card" key={i}>
          <div>{o.text}</div>
          {(o.note || o.from) && <div className="meta">{o.note}</div>}
          <div className="btn-row" style={{ marginTop: 6 }}>
            <button type="button" className="btn small primary" onClick={() => onUse(o.text)}>
              Use this
            </button>
            {onEdit && (
              <button type="button" className="btn small" onClick={() => onEdit(o.text)}>
                Edit, then use
              </button>
            )}
          </div>
        </div>
      ))}
      {!options.length && <div className="muted small">No options this time.</div>}
      <AssistFooter run={run} onRetry={onRetry} onClose={onClose} />
    </div>
  );
}

export function AssistFooter({ run, onRetry, onClose }: { run: AssistRun; onRetry?: () => void; onClose: () => void }) {
  return (
    <div className="btn-row">
      {onRetry && (
        <button type="button" className="btn small" onClick={onRetry}>
          Try again
        </button>
      )}
      <Thumbs runId={run.runId} />
      <button type="button" className="btn ghost small" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

/** Generic result renderer for the non-option outputs. */
export function ResultView({ action, run, onUseText, onRetry, onClose }: { action: AssistAction; run: AssistRun; onUseText?: (t: string) => void; onRetry?: () => void; onClose: () => void }): ReactNode {
  const o = run.output;
  let body: ReactNode = null;
  if (o.options) return <OptionCards run={run} onUse={(t) => onUseText?.(t)} onEdit={(t) => onUseText?.(t)} onRetry={onRetry} onClose={onClose} />;
  if (o.results)
    body = (
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {(o.results as { rule: string; pass: boolean; fix: string }[]).map((r, i) => (
          <li key={i}>
            <span className={r.pass ? "pass" : "fail"}>{r.pass ? "Pass" : "Fix"}</span>: {r.rule}
            {!r.pass && r.fix ? <div className="small muted">{r.fix}</div> : null}
          </li>
        ))}
      </ul>
    );
  else if (typeof o.text === "string") body = <p style={{ margin: 0 }}>{o.text}</p>;
  else if (o.chains)
    body = (o.chains as { start: string; level1: string; level2: string }[]).map((c, i) => (
      <div key={i} className="small" style={{ marginBottom: 6 }}>
        <strong>{c.start}</strong> → {c.level1} → {c.level2}
        {onUseText && (
          <button type="button" className="btn small" style={{ marginLeft: 6 }} onClick={() => onUseText(`${c.start}, so ${c.level1}, so ${c.level2}`)}>
            Use this
          </button>
        )}
      </div>
    ));
  else if (o.financial !== undefined)
    body = (
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Financial: {o.financial}</li>
        <li>Emotional: {o.emotional}</li>
        <li>Identity: {o.identity}</li>
      </ul>
    );
  else if (o.ranking)
    body = (
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {(o.ranking as { draft: number; reason: string }[]).map((r, i) => (
          <li key={i}>
            Draft {r.draft}: <span className="muted">{r.reason}</span>
          </li>
        ))}
      </ol>
    );
  else if (o.principle !== undefined)
    body = (
      <div className="small">
        <div>
          <strong>Principle:</strong> {o.principle}
        </div>
        <div>
          <strong>Stage:</strong> {o.stage}
        </div>
        <div>
          <strong>Check first:</strong> {o.checkFirst}
        </div>
        <div>
          <strong>One test:</strong> {o.test}
        </div>
      </div>
    );
  else if (o.lines || o.words)
    body = (
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {((o.lines ?? o.words) as string[]).map((l, i) => (
          <li key={i}>
            {l}{" "}
            {onUseText && (
              <button type="button" className="btn ghost small" onClick={() => onUseText(l)}>
                Use this
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  else if (o.answers)
    body = (o.answers as { question: string; answer: string }[]).map((a, i) => (
      <div key={i} className="small" style={{ marginBottom: 6 }}>
        <strong>{a.question}</strong>
        <div>{a.answer}</div>
      </div>
    ));
  else body = <pre className="json">{JSON.stringify(o, null, 2)}</pre>;
  void action;
  return (
    <div className="assist-card">
      <Tag kind="suggestion" />
      <Flags flags={run.flags} />
      <div style={{ marginTop: 6 }}>{body}</div>
      <AssistFooter run={run} onRetry={onRetry} onClose={onClose} />
    </div>
  );
}

/** Buttons under a writing field: Suggest when empty; Refine, Ideas and Check once there's text. Three at most, rest under More. */
export function AssistButtons({ fieldId, actions, text, onUse }: { fieldId: string; actions: AssistAction[]; text: string; onUse: (t: string, runId: string) => void }) {
  const { run, busy, error, available } = useAssist();
  const [result, setResult] = useState<{ action: AssistAction; run: AssistRun } | null>(null);
  const [more, setMore] = useState(false);
  if (!available || !actions.length) return null;
  const empty = !text.trim();
  const order = empty ? actions.filter((a) => a === "suggest" || a === "rank_drafts" || a === "pick_reviews" || a === "suggest_answers" || a === "suggest_followups" || a === "suggest_negatives" || a === "group_keywords") : actions.filter((a) => a !== "suggest");
  const shown = order.slice(0, 3);
  const rest = order.slice(3);
  const go = async (a: AssistAction) => {
    const r = await run(a, fieldId, text);
    if (r) setResult({ action: a, run: r });
  };
  return (
    <div>
      <div className="assist-bar">
        {[...shown, ...(more ? rest : [])].map((a) => (
          <button key={a} type="button" className="btn small" disabled={!!busy} onClick={() => go(a)}>
            {ACTION_SPEC[a].label}
          </button>
        ))}
        {rest.length > 0 && !more && (
          <button type="button" className="btn ghost small" onClick={() => setMore(true)}>
            More
          </button>
        )}
      </div>
      {busy && <div className="loading">{busy}</div>}
      {error && <div className="error">{error}</div>}
      {result && (
        <ResultView
          action={result.action}
          run={result.run}
          onUseText={(t) => {
            onUse(t, result.run.runId);
            setResult(null);
          }}
          onRetry={() => go(result.action)}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}
