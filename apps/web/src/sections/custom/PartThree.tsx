import { useEffect, useRef, useState } from "react";
import { MIN_AD_IDEAS, checkAdCta, scriptAsksForBooking, type AdIdea, type AdScript, type ScriptStatus } from "@pmw/engine";
import { useStore } from "../../lib/store.tsx";
import { useAssist, ResultView, OptionCards, Flags, type AssistRun } from "../../components/Assist.tsx";
import { ResearchPanel, SourceLink, type SourceRef } from "../../components/Research.tsx";
import { Tag, eg } from "../../components/bits.tsx";
import { api } from "../../lib/api.ts";

const MIN = MIN_AD_IDEAS.value;
// Ideas and hooks are one line each; the cell only wraps so long text stays readable.
const noEnter = (e: React.KeyboardEvent) => e.key === "Enter" && e.preventDefault();

function useIdeas() {
  const { answers, setAnswer } = useStore();
  const ideas = (Array.isArray(answers.ap_ideas) ? answers.ap_ideas : []) as AdIdea[];
  return { ideas, save: (next: AdIdea[], opts?: { origin?: "suggestion"; runId?: string }) => setAnswer("ap_ideas", next, opts) };
}

export function AdIdeas({ panel }: { panel?: { chip?: string; chipTone?: string; lead?: string; tone?: string } }) {
  const { answers, setAnswer, pack } = useStore();
  const { ideas, save } = useIdeas();
  const rows = ideas.length < MIN ? [...ideas, ...Array.from({ length: MIN - ideas.length }, () => ({ idea: "", source: "", hook: "" }))] : ideas;
  const filled = ideas.filter((i) => i.idea?.trim()).length;
  const { run, busy, error } = useAssist();
  const [candidates, setCandidates] = useState<{ run: AssistRun; picked: Set<number> } | null>(null);
  const [rowResult, setRowResult] = useState<{ index: number; action: string; run: AssistRun } | null>(null);
  const checkAll = answers.ap_check_all as { passed: boolean; ideaCount: number; pairs: { a: number; b: number; reason: string }[] } | undefined;

  const update = (i: number, patch: Partial<AdIdea>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    save(next.filter((r, j) => r.idea?.trim() || j < ideas.length));
  };

  return (
    <div className={`card ${panel?.tone ?? ""}`}>
      <div className="checklist-head">
        <div className={`chip ${panel?.chipTone ?? "red"}`}>{panel?.chip ?? "Your 12 ad ideas"}</div>
        <span className={`tag ${filled >= MIN ? "green" : ""}`}>
          {filled} of {MIN}
        </span>
      </div>
      {panel?.lead && <p className="lead">{panel.lead}</p>}
      <div className="note gold inset">
        Each idea = one problem, pain or previous attempt from your avatar. Hook formula: <strong>state the problem → hint at a better way → use committed language.</strong>
      </div>
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className="btn small assist-btn"
          disabled={!!busy}
          onClick={async () => {
            const r = await run("fill_from_avatar", "ap_ideas");
            if (r) setCandidates({ run: r, picked: new Set() });
          }}
        >
          Fill from my avatar
        </button>
        <button
          type="button"
          className="btn small assist-btn"
          disabled={!!busy || filled < 2}
          onClick={async () => {
            const r = await run("check_all_ideas", "ap_ideas");
            if (r) setAnswer("ap_check_all", { passed: r.output.pairs.length === 0, ideaCount: ideas.length, pairs: r.output.pairs, runId: r.runId });
          }}
        >
          Check all {MIN}
        </button>
      </div>
      {busy && <div className="loading">{busy}</div>}
      {error && <div className="error">{error}</div>}
      {checkAll && (
        <div className={`note small ${checkAll.passed ? "" : "warn"}`}>
          {checkAll.passed ? "No two ideas are too alike." : "Some ideas are too alike to count as unique ads (Meta Campaign rule 3):"}
          {checkAll.ideaCount !== ideas.length && " Your ideas changed since this check; run it again."}
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {checkAll.pairs.map((p, i) => (
              <li key={i}>
                Ideas {p.a} and {p.b}: {p.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {candidates && (
        <div className="assist-card" style={{ marginBottom: 10 }}>
          <Tag kind="suggestion" /> <span className="small">Tick the ideas you want. You need {MIN} in total.</span>
          {(candidates.run.output.ideas as { idea: string; source: string }[]).map((c, i) => (
            <label key={i} className="check">
              <input
                type="checkbox"
                checked={candidates.picked.has(i)}
                onChange={(e) => {
                  const picked = new Set(candidates.picked);
                  if (e.target.checked) picked.add(i);
                  else picked.delete(i);
                  setCandidates({ ...candidates, picked });
                }}
              />
              <span>
                {c.idea} <span className="tiny muted">from {c.source}</span>
              </span>
            </label>
          ))}
          <div className="btn-row">
            <button
              type="button"
              className="btn small primary"
              disabled={!candidates.picked.size}
              onClick={() => {
                const add = [...candidates.picked].map((i) => ({ idea: candidates.run.output.ideas[i].idea, source: candidates.run.output.ideas[i].source, hook: "" }));
                save([...ideas.filter((x) => x.idea?.trim()), ...add], { origin: "suggestion", runId: candidates.run.runId });
                setCandidates(null);
              }}
            >
              Add {candidates.picked.size} ideas
            </button>
            <button type="button" className="btn ghost small" onClick={() => setCandidates(null)}>
              Close
            </button>
          </div>
        </div>
      )}
      <div className="idea-table">
        <div className="idea-row idea-head">
          <span>#</span>
          <span>Ad idea: one problem, pain or previous attempt per row</span>
          <span>Hook</span>
        </div>
      {rows.map((r, i) => (
        <div key={i} className="idea-row">
            <span className="row-num">{i + 1}</span>
              <textarea rows={2} className="input" onKeyDown={noEnter} aria-label={`Idea ${i + 1}`} placeholder={eg(pack, `ap_ideas_${i + 1}`)} value={r.idea} onChange={(e) => update(i, { idea: e.target.value })} />
              <textarea rows={2} className="input" onKeyDown={noEnter} aria-label={`Hook ${i + 1}`} placeholder={eg(pack, `ap_hooks_${i + 1}`)} value={r.hook ?? ""} onChange={(e) => update(i, { hook: e.target.value })} />
            <div className="idea-extra">
              {r.source && <span className="tiny muted">From {r.source}</span>}
              {r.idea?.trim() && (
                <div className="btn-row row-actions">
                  {(["write_hooks", "check_hook", "more_like_this"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="btn small assist-btn"
                      disabled={!!busy || (a === "check_hook" && !r.hook?.trim())}
                      onClick={async () => {
                        const res = await run(a, "ap_ideas", a === "check_hook" ? r.hook : r.idea, { index: i + 1, idea: r.idea, hook: r.hook });
                        if (res) setRowResult({ index: i, action: a, run: res });
                      }}
                    >
                      {a === "write_hooks" ? "Write hooks" : a === "check_hook" ? "Check hook" : "More like this"}
                    </button>
                  ))}
                </div>
              )}
              {rowResult?.index === i && rowResult.action === "write_hooks" && (
                <div className="assist-cards">
                  <Flags flags={rowResult.run.flags} />
                  {(rowResult.run.output.hooks as { text: string; financialQualifier: boolean }[]).map((h, k) => (
                    <div className="assist-card" key={k}>
                      {h.text} {h.financialQualifier && <span className="tag">Financial qualifier</span>}
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          className="btn small primary"
                          onClick={() => {
                            update(i, { hook: h.text });
                            setRowResult(null);
                          }}
                        >
                          Use this
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="btn ghost small" onClick={() => setRowResult(null)}>
                    Close
                  </button>
                </div>
              )}
              {rowResult?.index === i && rowResult.action === "check_hook" && (
                <div className="assist-card">
                  <div>
                    <span className={`tag ${rowResult.run.output.label === "committed" ? "green" : "red"}`}>{rowResult.run.output.label === "committed" ? "Committed" : "Curious"}</span>{" "}
                    <span className="small">{rowResult.run.output.filters ? "Filters out the wrong people." : "Doesn't filter yet."}</span>
                  </div>
                  {rowResult.run.output.ruleOfOneBreak && <div className="small fail">Rule of One: {rowResult.run.output.ruleOfOneBreak}</div>}
                  {rowResult.run.output.fix && <div className="small muted">{rowResult.run.output.fix}</div>}
                  <button type="button" className="btn ghost small" onClick={() => setRowResult(null)}>
                    Close
                  </button>
                </div>
              )}
              {rowResult?.index === i && rowResult.action === "more_like_this" && (
                <OptionCards
                  run={rowResult.run}
                  onUse={(t) => {
                    save([...ideas.filter((x) => x.idea?.trim()), { idea: t, source: `like idea ${i + 1}`, hook: "" }], { origin: "suggestion", runId: rowResult.run.runId });
                  }}
                  onClose={() => setRowResult(null)}
                />
              )}
            </div>
        </div>
      ))}
      </div>
      <button type="button" className="btn small" style={{ marginTop: 8 }} onClick={() => save([...rows, { idea: "", source: "", hook: "" }])}>
        Add a row
      </button>
    </div>
  );
}

export function AdsRunning() {
  const { ws } = useStore();
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [pasted, setPasted] = useState("");
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const meta = ws?.channel !== "google";
  return (
    <div>
      {meta && (
        <div className="card">
          <div className="chip gold">See what's already running</div>
          <p className="lead">Meta only shares Australian ads on its public Ad Library website. Upload screenshots or paste the text of competitors' ads, and we'll pull out each hook, angle and emotion.</p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={async (e) => {
              if (!ws || !e.target.files) return;
              setUploadErr(null);
              for (const f of Array.from(e.target.files)) {
                const fd = new FormData();
                fd.append("file", f);
                fd.append("kind", "ad_screenshot");
                fd.append("workspace_id", ws.id);
                try {
                  const r = await api.post<{ id: string }>("/api/uploads", fd);
                  setUploaded((u) => [...u, r.id]);
                } catch {
                  setUploadErr("One of those files didn't upload. Images up to 5 MB.");
                }
              }
            }}
          />
          {uploaded.length > 0 && <p className="small">{uploaded.length} screenshots ready. They're deleted within 7 days.</p>}
          {uploadErr && <div className="error">{uploadErr}</div>}
          <textarea className="input" style={{ marginTop: 8 }} placeholder="Or paste ad text here, one ad per paragraph" value={pasted} onChange={(e) => setPasted(e.target.value)} />
        </div>
      )}
      <ResearchPanel recipe="ads_running" params={{ uploads: uploaded, pasted }}>
        {(r) => (
          <div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Who</th>
                    <th>Hook or angle</th>
                    <th>Emotion</th>
                  </tr>
                </thead>
                <tbody>
                  {(r.result.cards ?? []).map((a: { who: string; hook: string; angle: string; emotion: string; source: SourceRef }, i: number) => (
                    <tr key={i}>
                      <td>
                        {a.who}
                        <div>
                          <SourceLink source={a.source} />
                        </div>
                      </td>
                      <td>
                        {a.hook ? <div>{a.hook}</div> : null}
                        <div className="small muted">{a.angle}</div>
                      </td>
                      <td>{a.emotion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(r.result.anglesTaken ?? []).length > 0 && (
              <div className="small">
                <strong>Angles already taken:</strong>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(r.result.anglesTaken as string[]).map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {(r.result.gaps ?? []).length > 0 && (
              <div className="note tip small">
                <strong>Your ideas nobody else is running:</strong>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(r.result.gaps as { ideaNumber: number; note: string }[]).map((g, i) => (
                    <li key={i}>
                      Idea {g.ideaNumber}: {g.note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </ResearchPanel>
    </div>
  );
}

const STATUSES: ScriptStatus[] = ["scripted", "filmed", "edited", "captioned", "live"];

export function Scripts() {
  const { answers, setAnswer, pack } = useStore();
  const { ideas } = useIdeas();
  const scripts = (Array.isArray(answers.fa_scripts) ? answers.fa_scripts : []) as AdScript[];
  const { run, busy, error } = useAssist();
  const [prompter, setPrompter] = useState<number | null>(null);
  const [batch, setBatch] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<number, AssistRun["flags"]>>({});
  const save = (i: number, s: Partial<AdScript>) => {
    const next = [...scripts];
    while (next.length <= i) next.push({ hook: "", prove: "", cta: "", status: undefined });
    next[i] = { ...next[i], ...s };
    setAnswer("fa_scripts", next);
  };
  const scriptOne = async (i: number) => {
    const r = await run("script_idea", "fa_scripts", ideas[i].idea, { index: i + 1, idea: ideas[i].idea, hook: ideas[i].hook });
    if (r) {
      const next = [...((answers.fa_scripts as AdScript[]) ?? [])];
      while (next.length <= i) next.push({ hook: "", prove: "", cta: "" });
      next[i] = { ...(r.output as AdScript), status: "scripted" };
      setAnswer("fa_scripts", next, { origin: "suggestion", runId: r.runId });
      setFlags((f) => ({ ...f, [i]: r.flags }));
      return next;
    }
    return null;
  };
  if (!ideas.length) return <div className="note gold">Add your ad ideas in Ad Principles first, then script each one here.</div>;
  return (
    <div className="card">
      <div className="checklist-head">
        <div className="chip gold">Your scripts</div>
        <span className="tag">{ideas.filter((_, i) => scripts[i]?.prove || scripts[i]?.hook).length} of {ideas.length} scripted</span>
      </div>
      <p className="lead">Open an idea to write its hook, proof and call to action. The call to action is checked for you.</p>
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className="btn small assist-btn"
          disabled={!!busy || !!batch}
          onClick={async () => {
            for (let i = 0; i < ideas.length; i++) {
              if (scripts[i]?.prove) continue;
              setBatch(`Writing script ${i + 1} of ${ideas.length}...`);
              await scriptOne(i);
            }
            setBatch(null);
          }}
        >
          Script all {ideas.length}
        </button>
      </div>
      {(busy || batch) && <div className="loading">{batch ?? busy}</div>}
      {error && <div className="error">{error}</div>}
      {ideas.map((idea, i) => {
        const s = scripts[i] ?? { hook: "", prove: "", cta: "" };
        const cta = checkAdCta(s.cta ?? "");
        const booking = scriptAsksForBooking(`${s.hook} ${s.prove}`);
        const has = !!(s.hook || s.prove || s.cta);
        return (
          <details className="script" key={i}>
            <summary>
              <span className="s-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="s-idea">{idea.idea}</span>
              {has && <span className={`tag ${cta.ok && !booking ? "green" : "red"}`}>{cta.ok && !booking ? "CTA ok" : "Fix CTA"}</span>}
              <span className="tag">{s.status ?? "not started"}</span>
            </summary>
            <div className="s-body">
            <div className="field">
              <label>Status</label>
              <select className="input" style={{ width: "auto" }} aria-label="Status" value={s.status ?? ""} onChange={(e) => save(i, { status: (e.target.value || undefined) as ScriptStatus })}>
                <option value="">Not started</option>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st[0].toUpperCase() + st.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>01 Hook</label>
              <textarea className="input" value={s.hook} placeholder={idea.hook || eg(pack, `ap_hooks_${i + 1}`)} onChange={(e) => save(i, { hook: e.target.value })} />
            </div>
            <div className="field">
              <label>02 Prove your point</label>
              <textarea className="input" value={s.prove} placeholder={eg(pack, "fa_prove")} onChange={(e) => save(i, { prove: e.target.value })} />
            </div>
            <div className="field">
              <label>03 Tell them what to do</label>
              <input className={`input ${has ? (cta.ok ? "dial-green" : "dial-red") : ""}`} value={s.cta} placeholder="e.g. Click below to learn more." onChange={(e) => save(i, { cta: e.target.value })} />
              {has && <div className={`small ${cta.ok ? "pass" : "fail"}`}>{cta.reason}</div>}
              {booking && <div className="small fail">The script asks for a booking or a call. Only sell the click (Principle 07).</div>}
            </div>
            {s.shotNotes && (
              <div className="field">
                <label>Shot notes (captions and b-roll)</label>
                <textarea className="input" value={s.shotNotes} onChange={(e) => save(i, { shotNotes: e.target.value })} />
              </div>
            )}
            <Flags flags={flags[i] ?? []} />
            <div className="btn-row">
              <button
                type="button"
                className="btn small assist-btn"
                disabled={!!busy || !!batch}
                onClick={() => {
                  if (has && !window.confirm("Replace this script with a new draft?")) return;
                  void scriptOne(i);
                }}
              >
                {has ? "Script again" : "Script this idea"}
              </button>
              <button type="button" className="btn small" disabled={!has} onClick={() => setPrompter(i)}>
                Teleprompter
              </button>
            </div>
            </div>
          </details>
        );
      })}
      {prompter !== null && <Teleprompter text={[scripts[prompter]?.hook, scripts[prompter]?.prove, scripts[prompter]?.cta].filter(Boolean).join("\n\n")} onClose={() => setPrompter(null)} />}
    </div>
  );
}

export function Teleprompter({ text, onClose }: { text: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState(40);
  const [playing, setPlaying] = useState(false);
  const [size, setSize] = useState(44);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const step = (t: number) => {
      if (ref.current) ref.current.scrollTop += ((t - last) / 1000) * speed;
      last = t;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="prompter" role="dialog" aria-label="Teleprompter">
      <div className="text" ref={ref} style={{ fontSize: size, overflowY: "auto" }}>
        {text}
      </div>
      <div className="controls">
        <button type="button" className="btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="btn" onClick={() => ref.current && (ref.current.scrollTop = 0)}>
          Restart
        </button>
        <label>
          Speed <input type="range" min={10} max={150} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
        </label>
        <label>
          Size <input type="range" min={24} max={80} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export function TalkingPoints() {
  const { answers } = useStore();
  const { run, busy, error } = useAssist();
  const [res, setRes] = useState<AssistRun | null>(null);
  if (!answers.vsl_type) return null;
  return (
    <div className="card">
      <div className="chip teal">Talking points</div>
      <p className="lead">Short prompts to talk through, not a word for word script.</p>
      <button
        type="button"
        className="btn small assist-btn"
        disabled={!!busy}
        onClick={async () => {
          const r = await run("talking_points", "vsl_talking");
          if (r) setRes(r);
        }}
      >
        Make my talking points
      </button>
      {busy && <div className="loading">{busy}</div>}
      {error && <div className="error">{error}</div>}
      {res && (
        <div className="assist-card" style={{ marginTop: 8 }}>
          <Tag kind="suggestion" />
          {(res.output.points as { part: string; prompts: string[] }[]).map((p, i) => (
            <div key={i} className="small" style={{ marginTop: 6 }}>
              <strong>{p.part}</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {p.prompts.map((x, j) => (
                  <li key={j}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
          <button type="button" className="btn ghost small" onClick={() => setRes(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export { ResultView };
