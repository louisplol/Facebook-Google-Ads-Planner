import { useId } from "react";
import { exampleFor, fieldAnswerIds, conditionHolds, type Field } from "@pmw/engine";
import { useStore, useConditionContext } from "../lib/store.tsx";
import { AssistButtons } from "./Assist.tsx";
import { Tag } from "./bits.tsx";
import { ResearchButton } from "./Research.tsx";
import { ChannelResult } from "../sections/custom/PartOne.tsx";

const toNum = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s.replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const ROW_NOTE: Record<string, string> = { av_towards: "teal", av_away: "red", av_attempts: "gold" };

/** Text, textarea and the other simple field types, with example placeholders and writing help. */
export function FieldInput({ field, bar }: { field: Field; bar?: boolean }) {
  const ctx = useConditionContext();
  if (!conditionHolds(field.showWhen, ctx)) return null;
  if (field.type === "rows") return <RowsField field={field} />;
  const inner = <SingleField field={field} id={field.id} />;
  if (bar) return <div className="bar-field">{inner}</div>;
  if (field.tone) return <div className={`field-box ${field.tone}`}>{inner}</div>;
  return inner;
}

function PrefillHint({ fieldId, from }: { fieldId: string; from: string }) {
  const { answers, ws, setAnswer } = useStore();
  const current = answers[fieldId];
  const source = from.startsWith("ws.") ? ws?.[from.slice(3)] : answers[from];
  if ((current !== undefined && current !== "") || !source || typeof source !== "string") return null;
  return (
    <div className="tiny muted" style={{ marginTop: 3 }}>
      From your earlier answer: “{source.length > 70 ? `${source.slice(0, 70)}...` : source}”{" "}
      <button type="button" className="btn small" onClick={() => setAnswer(fieldId, source)}>
        Use this
      </button>
    </div>
  );
}

export function SingleField({ field, id, label, rowIndex, placeholder }: { field: Field; id: string; label?: string; rowIndex?: number; placeholder?: string }) {
  const { answers, origins, pack, setAnswer } = useStore();
  const htmlId = useId();
  const value = answers[id];
  const example = exampleFor(pack, id, field.exampleKey);
  const ph = placeholder ?? (example ? `e.g. ${example}` : "");
  const text = typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
  const origin = origins[id];
  const showLabel = rowIndex === undefined || !!label;
  const prefillFrom = field.prefillFrom ? (rowIndex !== undefined ? `${field.prefillFrom}${rowIndex}` : field.prefillFrom) : null;

  let control;
  switch (field.type) {
    case "textarea":
      control = <textarea id={htmlId} className="input" value={text} placeholder={ph} onChange={(e) => setAnswer(id, e.target.value)} />;
      break;
    case "number":
    case "currency":
    case "percent":
      control = (
        <div className="input-row">
          {field.type === "currency" && <span className="affix">$</span>}
          <input
            id={htmlId}
            className="input"
            inputMode="decimal"
            value={value === undefined || value === null ? "" : field.type === "percent" ? String(+(Number(value) * 100).toFixed(4)) : String(value)}
            onChange={(e) => {
              const n = toNum(e.target.value);
              setAnswer(id, n === null ? null : field.type === "percent" ? n / 100 : n);
            }}
          />
          {field.type === "percent" && <span className="affix">%</span>}
        </div>
      );
      break;
    case "choice": {
      const opts = field.options?.filter((o) => !o.hiddenForCompliance || !pack.compliance.includes(o.hiddenForCompliance as never)) ?? [];
      control = (
        <div className={`choice ${opts.length === 2 ? "two orange" : ""}`} role="radiogroup" aria-labelledby={htmlId}>
          {opts.map((o) => (
            <label key={o.value} className={value === o.value ? "on" : ""}>
              <input type="radio" name={id} checked={value === o.value} onChange={() => setAnswer(id, o.value)} />
              {o.label}
              {o.detail && opts.length === 2 && <span className="detail">{o.detail}</span>}
            </label>
          ))}
        </div>
      );
      break;
    }
    case "list":
      control = <ListInput id={id} placeholder={example} />;
      break;
    case "url":
      control = <input id={htmlId} className="input" type="url" inputMode="url" value={text} placeholder="https://" onChange={(e) => setAnswer(id, e.target.value)} />;
      break;
    case "checkbox":
      control = (
        <label className="check">
          <input type="checkbox" checked={value === true} onChange={(e) => setAnswer(id, e.target.checked)} /> <span>{field.label}</span>
        </label>
      );
      break;
    default:
      control = <input id={htmlId} className="input" value={text} placeholder={ph} onChange={(e) => setAnswer(id, e.target.value)} />;
  }

  const hideChoiceLabel = field.type === "choice" && field.id === "vsl_type";
  return (
    <div className="field">
      {showLabel && field.type !== "checkbox" && (
        <label htmlFor={htmlId} id={field.type === "choice" ? htmlId : undefined} className={hideChoiceLabel ? "sr-only" : undefined} style={field.type === "choice" && !hideChoiceLabel ? { fontFamily: "var(--serif)", fontSize: "0.98rem", color: "var(--ink)" } : undefined}>
          {label ?? field.label} {field.isNew && <span className="tag">New</span>}
        </label>
      )}
      {field.help && rowIndex === undefined && <div className="help">{field.help}</div>}
      {control}
      {prefillFrom && <PrefillHint fieldId={id} from={prefillFrom} />}
      {(origin === "suggestion" || origin === "edited_suggestion") && (
        <div style={{ marginTop: 3 }}>
          <Tag kind="suggestion">{origin === "suggestion" ? "Suggestion" : "Edited suggestion"}</Tag>
        </div>
      )}
      {field.type !== "choice" && field.type !== "checkbox" && field.assists && (
        <AssistButtons fieldId={id} actions={field.assists} text={Array.isArray(value) ? (value as string[]).join("\n") : text} onUse={(t, runId) => setAnswer(id, field.type === "list" ? t.split("\n").filter(Boolean) : t, { origin: "suggestion", runId })} />
      )}
      {field.id === "c3_awareness" && <ChannelResult />}
      {field.research && rowIndex === undefined && field.id !== "c3_awareness" && <ResearchButton recipe={field.research} />}
    </div>
  );
}

function RowsField({ field }: { field: Field }) {
  const { pack } = useStore();
  const ids = fieldAnswerIds(field);
  const drafts = field.label === "Draft";
  const tone = ROW_NOTE[field.id];
  return (
    <div className="field">
      {field.help && (tone ? <div className={`note ${tone} inset`}>{field.help}</div> : <div className="help">{field.help}</div>)}
      {!field.help && !drafts && <div className="label">{field.label}</div>}
      <div className={`rows ${field.columns === 2 ? "two" : ""}`}>
        {ids.map((id, i) => {
          const ex = exampleFor(pack, id, field.exampleKey);
          return (
            <SingleField
              key={id}
              field={{ ...field, type: drafts || field.id.startsWith("sa_pillar") ? "textarea" : "text", assists: field.assists }}
              id={id}
              rowIndex={i + 1}
              label={drafts ? `Draft ${i + 1}` : field.id.startsWith("sa_pillar") ? `Pillar ${i + 1}` : undefined}
              placeholder={ex ? `e.g. ${ex}` : `${field.rowPlaceholder ?? field.label} ${i + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function ListInput({ id, placeholder }: { id: string; placeholder?: string }) {
  const { answers, setAnswer } = useStore();
  const items = Array.isArray(answers[id]) ? (answers[id] as string[]) : [];
  return (
    <textarea
      className="input"
      value={items.join("\n")}
      placeholder={placeholder ? `One per line. e.g. ${placeholder}` : "One per line"}
      onChange={(e) => setAnswer(id, e.target.value.split("\n"))}
      onBlur={(e) => setAnswer(id, e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
    />
  );
}
