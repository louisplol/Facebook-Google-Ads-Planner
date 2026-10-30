import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { PARTS } from "@pmw/engine";
import { useStore } from "../lib/store.tsx";
import { SectionView } from "../sections/SectionView.tsx";
import { SaveState } from "../components/bits.tsx";

export function Sidebar({ current }: { current?: string }) {
  const { sections, ws, config, me } = useStore();
  const done = new Set(ws?.completed_sections ?? []);
  return (
    <nav className="sidebar" aria-label="Workbook sections">
      <Link to="/" className="side-brand">
        <div className="eyebrow-brand">Workbook</div>
        <div className="side-title">{config?.brandName}</div>
      </Link>
      <div className="side-nav">
        {sections.map((s, i) => (
          <Link key={s.id} to={`/workbook/${s.id}`} className={`${s.accent} ${s.id === current ? "active" : ""}`} aria-current={s.id === current ? "page" : undefined}>
            <span className="ic" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{s.title}</span>
            {done.has(s.id) && (
              <span className="done" aria-label="done">
                ✓
              </span>
            )}
          </Link>
        ))}
        <Link to="/plan" className={`gold ${current === "plan" ? "active" : ""}`}>
          <span className="ic" aria-hidden="true">
            ▤
          </span>
          <span>My Plan</span>
        </Link>
      </div>
      <div className="side-foot">
        <SaveState />
        {me && !me.user.saved && (
          <Link to="/save" className="help-link">
            Save my work →
          </Link>
        )}
        <Link to="/settings">Settings</Link>
        <Link to="/">← Back to home</Link>
      </div>
    </nav>
  );
}

export function Workbook() {
  const { sectionId } = useParams();
  const { ws, sections, completeSection, patchWorkspace, track } = useStore();
  const nav = useNavigate();
  const idx = sections.findIndex((s) => s.id === sectionId);
  const section = sections[idx];

  useEffect(() => {
    if (!section || !ws) return;
    track("section_viewed", { section: section.id });
    if (ws.last_section !== section.id) void patchWorkspace({ last_section: section.id }).catch(() => undefined);
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section?.id]);

  if (!ws) return <Navigate to="/" replace />;
  if (!ws.onboarding_done_at) return <Navigate to="/onboarding" replace />;
  if (!section) return <Navigate to={`/workbook/${sections[0]?.id ?? "three-cs"}`} replace />;

  const done = new Set(ws.completed_sections ?? []);
  const prev = sections[idx - 1];
  const next = sections[idx + 1];
  const isDone = done.has(section.id);
  const allDone = sections.every((s) => done.has(s.id));

  return (
    <div className="shell">
      <Sidebar current={section.id} />
      <div>
        <div className="section-picker">
          <label className="sr-only" htmlFor="section-picker">
            Go to section
          </label>
          <select id="section-picker" value={section.id} onChange={(e) => nav(`/workbook/${e.target.value}`)}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {PARTS[s.part].split(":")[0]} · {s.title}
                {done.has(s.id) ? " ✓" : ""}
              </option>
            ))}
          </select>
        </div>
        <main className="page">
          <SectionView section={section} />
          <div className="section-foot no-print">
            {prev ? (
              <Link className="btn" to={`/workbook/${prev.id}`}>
                ← {prev.title}
              </Link>
            ) : (
              <span />
            )}
            <button type="button" className={`done-toggle ${isDone ? "on" : ""}`} onClick={() => completeSection(section.id, !isDone)}>
              {isDone ? "✓ Section done" : "Mark this section done"}
            </button>
            {next ? (
              <Link className="btn primary" to={`/workbook/${next.id}`}>
                {next.title} →
              </Link>
            ) : allDone ? (
              <Link className="complete-mark" to="/plan">
                ✓ WORKBOOK COMPLETE · My Plan →
              </Link>
            ) : (
              <Link className="btn primary" to="/plan">
                My Plan →
              </Link>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
