import { useState, type ReactNode } from "react";
import { GLOSSARY, exampleFor, formatMoney, formatPercent, type IndustryPack } from "@pmw/engine";
import { useStore } from "../lib/store.tsx";

/** "e.g. ..." placeholder for an answer id from the industry pack, or "" when there is none. Lists don't wrap around. */
export const eg = (pack: IndustryPack, id: string): string => {
  const m = /_(\d+)$/.exec(id);
  const list = m ? (pack.examples as unknown as Record<string, unknown>)[id.slice(0, m.index)] : undefined;
  if (m && Array.isArray(list) && Number(m[1]) > list.length) return "";
  const x = exampleFor(pack, id);
  return x ? `e.g. ${x}` : "";
};

export type NumberKind = "input" | "benchmark" | "market" | "suggestion" | "example" | "website" | "forecast";

const KIND_LABEL: Record<NumberKind, string> = {
  input: "Your input",
  benchmark: "Benchmark",
  market: "Market data",
  suggestion: "Suggestion",
  example: "Example",
  website: "From your website",
  forecast: "From your forecast",
};

/** Every number is labelled: your input, benchmark, market data or suggestion. */
export function Tag({ kind, children }: { kind: NumberKind; children?: ReactNode }) {
  const cls = kind === "market" || kind === "website" ? "market" : kind === "forecast" ? "benchmark" : kind;
  return <span className={`tag ${cls}`}>{children ?? KIND_LABEL[kind]}</span>;
}

/** Tap-to-explain for jargon, from the static glossary. */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[id];
  if (!g) return <>{children}</>;
  return (
    <span style={{ position: "relative" }}>
      <button type="button" className="btn ghost small" style={{ padding: 0, minHeight: 0, textDecoration: "underline dotted", fontWeight: "inherit", fontFamily: "inherit", fontSize: "inherit", color: "inherit" }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {children ?? g.term}
      </button>
      {open && (
        <span role="note" className="card small" style={{ position: "absolute", zIndex: 30, top: "1.6em", left: 0, width: "min(300px, 80vw)", fontWeight: 400 }}>
          <strong>{g.term}</strong>: {g.plain}{" "}
          <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>
            Close
          </button>
        </span>
      )}
    </span>
  );
}

export function useMoney() {
  const { ws } = useStore();
  const currency = ws?.currency ?? "AUD";
  return (v: number | null | undefined, decimals = 0) => formatMoney(v, currency, decimals);
}

export const pct = (v: number | null | undefined, d = 1) => formatPercent(v, d);

/** Shows "how this was worked out": formula plus inputs. */
export function Working({ formula, inputs, render }: { formula: string; inputs?: Record<string, number | null>; render?: (k: string, v: number) => string }) {
  return (
    <details className="working">
      <summary title="Show working" aria-label="Show working">ƒ</summary>
      <div className="formula">{formula}</div>
      {inputs && (
        <div className="formula">
          {Object.entries(inputs)
            .map(([k, v]) => `${k}: ${v === null ? "not set" : render ? render(k, v) : Number.isInteger(v) ? v : v.toFixed(4)}`)
            .join(" · ")}
        </div>
      )}
    </details>
  );
}

export function SaveState() {
  const { saving } = useStore();
  const text = saving === "saving" ? "Saving..." : saving === "saved" ? "Saved" : saving === "error" ? "Not saved yet, retrying" : "";
  return (
    <span className="save-state" role="status" aria-live="polite">
      {text}
    </span>
  );
}

export function Spinner({ text }: { text: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      {text}
    </div>
  );
}
