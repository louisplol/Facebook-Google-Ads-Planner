import type { ReactNode } from "react";
import { conditionHolds, PARTS, type Block, type Section } from "@pmw/engine";
import { useConditionContext, useStore } from "../lib/store.tsx";
import { FieldInput } from "../components/FieldInput.tsx";
import { Checklist } from "../components/Checklist.tsx";
import { CUSTOM } from "./custom/index.tsx";

function VideoRange({ section }: { section: Section }) {
  const { config } = useStore();
  if (!section.video) return <div className="stamp">New section</div>;
  const { start, end, assumed } = section.video;
  const text = `⏱ ${start} - ${end}${assumed ? " (approx)" : ""}`;
  if (!config?.videoUrl) return <div className="stamp">{text}</div>;
  const [h, m, s] = start.split(":").map(Number);
  const url = new URL(config.videoUrl);
  url.searchParams.set("t", String(h * 3600 + m * 60 + s));
  return (
    <div className="stamp">
      <a href={url.toString()} target="_blank" rel="noopener noreferrer">
        {text}
      </a>
    </div>
  );
}

/** A panel: tinted card with an optional mono chip and lead line. */
export function Panel({ block, children, bare }: { block: { chip?: string; chipTone?: string; lead?: string; tone?: string }; children: ReactNode; bare?: boolean }) {
  const head = (
    <>
      {block.chip && <div className={`chip ${block.chipTone ?? ""}`}>{block.chip}</div>}
      {block.lead && <p className="lead">{block.lead}</p>}
    </>
  );
  if (bare) return <>{children}</>;
  return (
    <div className={`card ${block.tone && block.tone !== "plain" ? block.tone : ""}`}>
      {head}
      {children}
    </div>
  );
}

export function BlockView({ block }: { block: Block }) {
  const ctx = useConditionContext();
  if (!conditionHolds(block.showWhen, ctx)) return null;
  switch (block.kind) {
    case "intro":
      return <p className="lead">{block.text}</p>;
    case "note":
      return (
        <div className={`note ${block.noteTone ?? "teal"}`}>
          {block.noteTone === "assumed" && <strong>Note: </strong>}
          {block.strong && <strong>{block.strong} </strong>}
          {block.text}
        </div>
      );
    case "cards": {
      const grid = (
        <div className={`cards ${block.columns === 3 ? "c3" : block.columns === 2 ? "c2" : ""}`}>
          {block.items.map((c) => (
            <div className={`box ${c.tone ?? ""}`} key={c.title}>
              <div className="box-title">
                {c.number ? `${c.number}: ` : ""}
                {c.title}
              </div>
              {c.quote && block.chip === "Hook formula" && <div className="box-body" style={{ fontWeight: 700, fontStyle: "italic", color: "var(--ink)", marginBottom: 6 }}>{c.quote}</div>}
              <div className="box-body">{c.body}</div>
              {c.quote && block.chip !== "Hook formula" && <div className="box-quote">{c.quote}</div>}
              {c.meta && <div className="box-meta">{c.meta}</div>}
            </div>
          ))}
        </div>
      );
      return <Panel block={block}>{grid}</Panel>;
    }
    case "table":
      return (
        <Panel block={block}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {block.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={j} className={j === 0 && block.firstColTones?.[i] ? `c-${block.firstColTones[i]}` : ""}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      );
    case "steps":
      return (
        <Panel block={block}>
          <div className="stages">
            {block.items.map((s, i) => (
              <div className="stage" key={s.title}>
                <div className="st-head">
                  <span className="st-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="st-title">{s.title}</span>
                  {s.time && <span className="st-time">{s.time}</span>}
                </div>
                <div className="st-body">{s.body}</div>
              </div>
            ))}
          </div>
        </Panel>
      );
    case "numbered":
      return (
        <Panel block={block}>
          <ol className="numbered">
            {block.items.map((it, i) => (
              <li key={i}>
                <span>
                  {it.title && <strong>{it.title} </strong>}
                  {it.body}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      );
    case "tiles":
      return (
        <Panel block={block}>
          <div className="tiles">
            {block.items.map((t) => (
              <div className="tile" key={t.title}>
                <div className="t-top">{t.top}</div>
                <div className="t-title">{t.title}</div>
              </div>
            ))}
          </div>
          {block.after && <div className="note teal inset">{block.after}</div>}
        </Panel>
      );
    case "fields": {
      const visible = block.fields.filter((f) => conditionHolds(f.showWhen, ctx));
      if (!visible.length) return null;
      const cols = block.columns ?? 1;
      return (
        <Panel block={block}>
          {block.title && <h3>{block.title}</h3>}
          <div className={cols === 3 ? "grid3" : cols === 2 ? "grid2" : ""} style={cols === 1 ? undefined : { alignItems: "start" }}>
            {visible.map((f) => (
              <div key={f.id} className={cols > 1 && (f.type === "textarea" || f.type === "rows" || f.type === "list") && cols === 3 && !f.tone ? "span-all" : ""}>
                <FieldInput field={f} bar={block.bars} />
              </div>
            ))}
          </div>
        </Panel>
      );
    }
    case "checklist":
      return <ChecklistWithAssist block={block} />;
    case "row": {
      const kids = block.blocks.filter((b) => conditionHolds(b.showWhen, ctx));
      return (
        <div className="panel-row">
          {kids.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </div>
      );
    }
    case "custom": {
      const C = CUSTOM[block.component];
      if (!C) return <div className="note assumed">Coming soon: {block.component}</div>;
      return <C panel={block} />;
    }
  }
}

function ChecklistWithAssist({ block }: { block: Extract<Block, { kind: "checklist" }> }) {
  const Nurture = CUSTOM.NurtureWrite;
  return <Checklist block={block} renderAssist={Nurture ? (id) => <Nurture itemId={id} /> : undefined} />;
}

export function SectionView({ section }: { section: Section }) {
  return (
    <article>
      <header className="section-head">
        <div className="eyebrow">
          {PARTS[section.part]}
          {section.partAssumed ? " (assumed)" : ""}
        </div>
        <div className="title-row">
          <div className={`icon-tile ${section.accent}`} aria-hidden="true">
            {section.icon}
          </div>
          <h1>
            {section.heading ?? section.title} {section.isNew && <span className="tag">New</span>}
          </h1>
        </div>
        <VideoRange section={section} />
      </header>
      {section.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </article>
  );
}
