import { useState } from "react";
import { checkFormOrder, checkSms, type FormQuestion, type TrackingResult } from "@pmw/engine";
import { useStore } from "../../lib/store.tsx";
import { useAssist, ResultView, type AssistRun, Flags } from "../../components/Assist.tsx";
import { api, ApiError } from "../../lib/api.ts";
import { Tag, eg } from "../../components/bits.tsx";
import { downloadCsv } from "../../lib/csv.ts";

export function FormQuestions() {
  const { answers, setAnswer, pack } = useStore();
  const qs = (Array.isArray(answers.lp_form_questions) ? answers.lp_form_questions : []) as FormQuestion[];
  const order = checkFormOrder(qs);
  const { run, busy, error } = useAssist();
  const [res, setRes] = useState<AssistRun | null>(null);
  const update = (i: number, patch: Partial<FormQuestion>) => setAnswer("lp_form_questions", qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...qs];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    setAnswer("lp_form_questions", next);
  };
  return (
    <div className="card">
      <div className="chip gold">Application form questions</div>
      <p className="lead">Low commitment first, contact details last.</p>
      {qs.map((q, i) => (
        <div key={i} className="input-row" style={{ marginBottom: 8, flexWrap: "wrap" }}>
          <span className="row-num">{i + 1}</span>
          <input className="input" style={{ flex: "1 1 80%" }} aria-label={`Question ${i + 1}`} value={q.question} placeholder={eg(pack, `lp_form_questions_${i + 1}`) || "Question"} onChange={(e) => update(i, { question: e.target.value })} />
          <select className="input" style={{ width: "auto" }} value={q.answerType} onChange={(e) => update(i, { answerType: e.target.value })}>
            {["short text", "choice", "number", "email", "phone"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select className="input" style={{ width: "auto" }} value={q.purpose} onChange={(e) => update(i, { purpose: e.target.value as FormQuestion["purpose"] })}>
            <option value="qualify">Qualify</option>
            <option value="commit">Commit</option>
            <option value="contact">Contact</option>
          </select>
          <button type="button" className="btn small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
            ↑
          </button>
          <button type="button" className="btn small" disabled={i === qs.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
            ↓
          </button>
          <button type="button" className="btn small" onClick={() => setAnswer("lp_form_questions", qs.filter((_, j) => j !== i))} aria-label="Remove">
            ×
          </button>
        </div>
      ))}
      {!order.ok && <div className="note warn small">Question {order.firstBadIndex! + 1} comes after a contact question. Move contact details to the end (Principle 09).</div>}
      <div className="btn-row">
        <button type="button" className="btn small" onClick={() => setAnswer("lp_form_questions", [...qs, { question: "", answerType: "short text", purpose: "qualify" }])}>
          Add a question
        </button>
        <button
          type="button"
          className="btn small assist-btn"
          disabled={!!busy}
          onClick={async () => {
            const r = await run("suggest_questions", "lp_form_questions");
            if (r) setRes(r);
          }}
        >
          Suggest questions
        </button>
      </div>
      {busy && <div className="loading">{busy}</div>}
      {error && <div className="error">{error}</div>}
      {res && (
        <div className="assist-card" style={{ marginTop: 8 }}>
          <Tag kind="suggestion" />
          <ol className="small" style={{ paddingLeft: 18 }}>
            {(res.output.questions as FormQuestion[]).map((q, i) => (
              <li key={i}>
                {q.question} <span className="muted">({q.purpose})</span>
              </li>
            ))}
          </ol>
          <div className="btn-row">
            <button
              type="button"
              className="btn small primary"
              onClick={() => {
                setAnswer("lp_form_questions", [...qs, ...(res.output.questions as FormQuestion[])], { origin: "suggestion", runId: res.runId });
                setRes(null);
              }}
            >
              Add these
            </button>
            <button type="button" className="btn ghost small" onClick={() => setRes(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PageLinks() {
  const { answers, setAnswer, ws } = useStore();
  const urls = (answers.lp_urls ?? {}) as Record<string, string>;
  const set = (k: string, v: string) => setAnswer("lp_urls", { ...urls, [k]: v });
  const { run, busy, error } = useAssist();
  const [review, setReview] = useState<AssistRun | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const tracking = answers.lp_tracking as TrackingResult | undefined;
  const twoStep = ws?.funnel_type !== "1step" && ws?.funnel_type !== "checkout";
  return (
    <div className="card">
      <div className="chip teal">Your live page links</div>
      {[
        ["application", "Application page"],
        ...(twoStep ? [["booking", "Booking page"]] : []),
        ["thankyou", "Thank you page"],
      ].map(([k, l]) => (
        <div className="field" key={k}>
          <label htmlFor={`lp_url_${k}`}>{l}</label>
          <input id={`lp_url_${k}`} className="input" type="url" inputMode="url" placeholder="https://" value={urls[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
        </div>
      ))}
      <div className="btn-row">
        <button
          type="button"
          className="btn small assist-btn"
          disabled={!!busy || !urls.application}
          onClick={async () => {
            const r = await run("review_page", "lp_page", undefined, { url: urls.application });
            if (r) setReview(r);
          }}
        >
          Review my page
        </button>
        <button
          type="button"
          className="btn small"
          disabled={checking || !Object.values(urls).some(Boolean)}
          onClick={async () => {
            if (!ws) return;
            setChecking(true);
            setCheckErr(null);
            try {
              const r = await api.post<TrackingResult>("/api/page-check/tracking", { workspace_id: ws.id, urls });
              setAnswer("lp_tracking", r);
            } catch (e) {
              setCheckErr(e instanceof ApiError ? e.message : "Couldn't read your pages. Try again.");
            } finally {
              setChecking(false);
            }
          }}
        >
          {checking ? "Looking for your tracking..." : "Check tracking"}
        </button>
      </div>
      {busy && <div className="loading">{busy}</div>}
      {(error || checkErr) && <div className="error">{error ?? checkErr}</div>}
      {review && <ResultView action="review_page" run={review} onClose={() => setReview(null)} />}
      {tracking && <TrackingTable tracking={tracking} />}
    </div>
  );
}

const yesNo = (v: boolean | null) => (v === null ? "not checked" : v ? "found" : "not found; check with Meta Pixel Helper");

function TrackingTable({ tracking }: { tracking: TrackingResult }) {
  return (
    <div style={{ marginTop: 10 }}>
      <p className="small">
        <strong>{tracking.passed ? "Tracking looks right." : "Some tracking is missing."}</strong> <span className="muted">Checked {tracking.checkedAt.slice(0, 16).replace("T", " ")}</span>
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Page</th>
              <th>Pixel</th>
              <th>Lead event</th>
              <th>Schedule event</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(tracking.pages).map(([k, p]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{yesNo(p.pixel)}</td>
                <td>{yesNo(p.lead)}</td>
                <td>{yesNo(p.schedule)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TrackingEvidence() {
  const { site, answers } = useStore();
  const found = site?.tracking;
  const t = answers.lp_tracking as TrackingResult | undefined;
  if (!found && !t) return <p className="small muted">Tip: run Check tracking in Landing Page to see what's on your live pages. It never ticks anything for you.</p>;
  return (
    <div className="note small">
      <strong>Evidence for items 6 to 8:</strong>{" "}
      {t ? (t.passed ? "your last tracking check passed." : "your last tracking check found gaps.") : null}{" "}
      {found && Object.keys(found).length > 0 && <>On your website we found: {found.metaPixel ? "the Meta pixel" : "no Meta pixel"}, {found.googleTag ? "a Google tag" : "no Google tag"}.</>} This evidence ticks nothing by itself.
    </div>
  );
}

interface Msg {
  channel: "sms" | "email";
  subject: string;
  body: string;
}

const NURTURE_NUMBERS = ["1", "2", "4", "5", "6", "7", "8"];

export function NurtureWrite({ itemId }: { itemId: string }) {
  const { answers, setAnswer } = useStore();
  const n = itemId.replace("bf_nurture_", "");
  const key = `bf_msg_${n}`;
  const msg = answers[key] as Msg | undefined;
  const { run, busy, error } = useAssist();
  const [flags, setFlags] = useState<AssistRun["flags"]>([]);
  const needsTestimonials = n === "4" && !String(answers.bf_testimonials ?? "").trim();
  return (
    <div style={{ marginLeft: 30, marginBottom: 8 }}>
      {msg ? (
        <div className="assist-card">
          <div className="tiny muted">
            {msg.channel.toUpperCase()}
            {msg.channel === "sms" && ` · ${checkSms(msg.body).length} of 160 characters`}
          </div>
          {msg.channel === "email" && <input className="input" value={msg.subject} onChange={(e) => setAnswer(key, { ...msg, subject: e.target.value })} aria-label="Subject" style={{ marginBottom: 6 }} />}
          <textarea className="input" value={msg.body} onChange={(e) => setAnswer(key, { ...msg, body: e.target.value })} aria-label="Message" />
          {msg.channel === "sms" && !checkSms(msg.body).ok && <div className="error small">Over one SMS (160 characters).</div>}
          <Flags flags={flags} />
        </div>
      ) : null}
      {needsTestimonials && <div className="small muted">Paste real testimonials below first. With none, the draft leaves a gap for you to fill.</div>}
      <button
        type="button"
        className="btn small assist-btn"
        disabled={!!busy}
        onClick={async () => {
          if (msg && !window.confirm("Replace your current draft with a new one?")) return;
          const r = await run("write_message", `bf_nurture_${n}`, msg?.body, { message: n });
          if (r) {
            setAnswer(key, r.output as Msg, { origin: "suggestion", runId: r.runId });
            setFlags(r.flags);
          }
        }}
      >
        {msg ? "Write again" : "Write this"}
      </button>
      {busy && <span className="loading"> {busy}</span>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export function NurtureMessages() {
  const { answers, setAnswer } = useStore();
  const { run, busy } = useAssist();
  const [progress, setProgress] = useState<string | null>(null);
  const writeAll = async () => {
    for (const n of NURTURE_NUMBERS) {
      if (answers[`bf_msg_${n}`]) continue;
      setProgress(`Writing message ${n}...`);
      const r = await run("write_message", `bf_nurture_${n}`, undefined, { message: n });
      if (r) setAnswer(`bf_msg_${n}`, r.output, { origin: "suggestion", runId: r.runId });
    }
    setProgress(null);
  };
  const download = () => {
    const rows = NURTURE_NUMBERS.filter((n) => answers[`bf_msg_${n}`]).map((n) => {
      const m = answers[`bf_msg_${n}`] as Msg;
      return [n, m.channel, m.subject, m.body];
    });
    downloadCsv("nurture-sequence.csv", [["Message", "Channel", "Subject", "Body"], ...rows]);
  };
  return (
    <div className="card">
      <div className="chip teal">Your nurture messages</div>
      <div className="field">
        <label htmlFor="bf_testimonials">Real testimonials to use in message 4 (paste them here)</label>
        <textarea id="bf_testimonials" className="input" placeholder="Paste real reviews here, from Google or messages your clients have sent you" value={String(answers.bf_testimonials ?? "")} onChange={(e) => setAnswer("bf_testimonials", e.target.value)} />
        <p className="tiny muted">We never write testimonials for you.</p>
      </div>
      <p className="small muted">Merge fields: {"{first_name}"}, {"{call_time}"}, {"{zoom_link}"}, {"{vsl_link}"}. SMS drafts stay within one 160 character message.</p>
      <div className="btn-row">
        <button type="button" className="btn small assist-btn" disabled={!!busy || !!progress} onClick={writeAll}>
          Write all
        </button>
        <button type="button" className="btn small" onClick={download}>
          Download
        </button>
      </div>
      {progress && <div className="loading">{progress}</div>}
    </div>
  );
}

export { ResultView };
