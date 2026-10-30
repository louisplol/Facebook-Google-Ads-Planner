import type { ReactNode } from "react";
import { conditionHolds, type Block } from "@pmw/engine";
import { useStore, useConditionContext } from "../lib/store.tsx";

type ChecklistBlock = Extract<Block, { kind: "checklist" }>;

export function Checklist({ block, renderAssist }: { block: ChecklistBlock; renderAssist?: (itemId: string) => ReactNode }) {
  const { answers, setAnswer } = useStore();
  const ctx = useConditionContext();
  const items = block.items.filter((i) => conditionHolds(i.showWhen, ctx));
  if (!items.length) return null;
  const done = items.filter((i) => answers[i.id] === true).length;
  return (
    <div className={`card ${block.tone && block.tone !== "plain" ? block.tone : ""}`}>
      <div className="checklist-head">
        <div className={`chip ${block.chipTone ?? ""}`}>{block.chip ?? block.title}</div>
        <span className="tag">
          {done}/{items.length}
        </span>
      </div>
      {block.goal && <p className="lead">{block.goal}</p>}
      {items.map((i) => (
        <div key={i.id}>
          <label className="check">
            <input type="checkbox" checked={answers[i.id] === true} onChange={(e) => setAnswer(i.id, e.target.checked)} />
            <span>
              {i.when && <span className="when">{i.when}</span>}
              {i.label}
            </span>
          </label>
          {i.assist && renderAssist?.(i.id)}
        </div>
      ))}
    </div>
  );
}
