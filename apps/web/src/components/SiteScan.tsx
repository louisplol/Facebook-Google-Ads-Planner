import { useCallback, useEffect, useRef, useState } from "react";
import { useStore, type SiteProfile } from "../lib/store.tsx";
import { api, ApiError } from "../lib/api.ts";
import { Turnstile, hostOf } from "./Research.tsx";

interface Item {
  name?: string;
  text?: string;
  page: string;
  ticked?: boolean;
}

interface Competitor {
  domain: string;
  keywordsCommon: number | null;
  ticked: boolean;
  directory: boolean;
}

/** Starts and follows the website scan for the current workspace. */
export function useSiteScan() {
  const { ws, site, setSite } = useStore();
  const [needsTurnstile, setNeedsTurnstile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!ws) return null;
    const s = await api.get<Omit<SiteProfile, "status"> & { status: SiteProfile["status"] | "none" }>(`/api/site-scan?workspace_id=${ws.id}`);
    if (s.status === "none") return null;
    setSite(s as SiteProfile);
    return s;
  }, [ws, setSite]);

  const poll = useCallback(() => {
    const tick = async () => {
      const s = await refresh().catch(() => null);
      if (s?.status === "scanning") timer.current = window.setTimeout(tick, 2500);
    };
    void tick();
  }, [refresh]);

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const start = async (turnstileToken?: string) => {
    if (!ws) return;
    setError(null);
    try {
      await api.post("/api/site-scan", { workspace_id: ws.id, turnstile_token: turnstileToken });
      setNeedsTurnstile(false);
      setSite({ ...(site ?? ({} as SiteProfile)), status: "scanning" });
      poll();
    } catch (e) {
      if (e instanceof ApiError && e.code === "turnstile") setNeedsTurnstile(true);
      else setError(e instanceof ApiError ? e.message : "The scan didn't start. You can carry on and try again later.");
    }
  };

  const noWebsite = async () => {
    if (!ws) return;
    await api.post("/api/site-scan/no-website", { workspace_id: ws.id });
    await refresh();
  };

  return { start, noWebsite, refresh, poll, needsTurnstile, error };
}

export function ScanReview({ onDone }: { onDone: () => void }) {
  const { site, ws, setSite, patchWorkspace } = useStore();
  const scan = useSiteScan();
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void scan.refresh().then((s) => {
      if (s?.status === "scanning") scan.poll();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (site?.status === "needs_confirm" || site?.status === "confirmed") {
      const p = site.profile ?? {};
      setDraft({
        ...p,
        services: (p.services ?? []).map((x: Item) => ({ ...x, ticked: x.ticked ?? true })),
        places: (p.places ?? []).map((x: Item) => ({ ...x, ticked: x.ticked ?? true })),
        competitors: p.competitors ?? [],
      });
    }
  }, [site?.status, site?.scanned_at]);

  if (!ws) return null;

  if (ws.no_website || site?.status === "no_website")
    return (
      <div>
        <p>No website yet, no problem. Research will use your description, industry and service area, and every result will say so.</p>
        <button type="button" className="btn primary" onClick={onDone}>
          Start the workbook
        </button>
      </div>
    );

  if (!site || site.status === "scanning")
    return (
      <div>
        {scan.needsTurnstile && <Turnstile onToken={(t) => scan.start(t)} />}
        {!site && !scan.needsTurnstile && (
          <>
            <p>We haven't read your website yet.</p>
            <button type="button" className="btn" onClick={() => scan.start()}>
              Scan my website
            </button>
          </>
        )}
        {site?.status === "scanning" && <p className="loading">Reading your website. This usually takes under a minute.</p>}
        {scan.error && <div className="error">{scan.error}</div>}
        <p className="small muted">You can start the workbook now and come back to confirm this later. Research buttons unlock once it's confirmed.</p>
        <button type="button" className="btn" onClick={onDone}>
          Start the workbook now
        </button>
      </div>
    );

  if (site.status === "failed")
    return (
      <div>
        <div className="note warn">{site.error || "We couldn't read your website."}</div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => scan.start()}>
            Try again
          </button>
          <button type="button" className="btn" onClick={() => scan.noWebsite()}>
            Carry on without it
          </button>
          <button type="button" className="btn primary" onClick={onDone}>
            Start the workbook
          </button>
        </div>
      </div>
    );

  if (!draft) return null;

  const toggle = (key: "services" | "places", i: number) => setDraft({ ...draft, [key]: draft[key].map((x: Item, j: number) => (j === i ? { ...x, ticked: !x.ticked } : x)) });
  const edit = (key: "services" | "places", i: number, v: string) => setDraft({ ...draft, [key]: draft[key].map((x: Item, j: number) => (j === i ? { ...x, name: v } : x)) });
  const remove = (key: "services" | "places", i: number) => setDraft({ ...draft, [key]: draft[key].filter((_: Item, j: number) => j !== i) });
  const add = (key: "services" | "places") => setDraft({ ...draft, [key]: [...draft[key], { name: "", page: "added by you", ticked: true }] });

  const confirm = async () => {
    setSaving(true);
    const profile = {
      ...draft,
      services: draft.services.filter((x: Item) => x.ticked && (x.name ?? "").trim()),
      places: draft.places.filter((x: Item) => x.ticked && (x.name ?? "").trim()),
    };
    await api.post("/api/site-scan/confirm", { workspace_id: ws.id, profile });
    setSite({ ...site, status: "confirmed", profile });
    // Suggestions only: fill blanks the user hasn't answered.
    const fill: Record<string, unknown> = {};
    if (!ws.service_city && profile.places[0]?.name) fill.service_city = profile.places[0].name;
    if (!ws.audience_type && ["b2b", "b2c", "both"].includes(profile.audience)) fill.audience_type = profile.audience;
    if (Object.keys(fill).length) await patchWorkspace(fill);
    setSaving(false);
    onDone();
  };

  const list = (key: "services" | "places", title: string) => (
    <div className="card">
      <h3>{title}</h3>
      {draft[key].length === 0 && <p className="small muted">None found.</p>}
      {draft[key].map((x: Item, i: number) => (
        <div key={i} className="input-row" style={{ marginBottom: 6 }}>
          <input type="checkbox" aria-label={`Keep ${x.name}`} checked={!!x.ticked} onChange={() => toggle(key, i)} />
          <input className="input" value={x.name ?? ""} onChange={(e) => edit(key, i, e.target.value)} />
          <span className="tiny muted" style={{ minWidth: 80 }}>
            {x.page?.startsWith("http") ? (
              <a href={x.page} target="_blank" rel="noopener noreferrer">
                {new URL(x.page).pathname || "/"}
              </a>
            ) : (
              x.page
            )}
          </span>
          <button type="button" className="btn ghost small" aria-label="Remove" onClick={() => remove(key, i)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => add(key)}>
        Add
      </button>
    </div>
  );

  return (
    <div>
      <p>
        We read <strong>{site.domain}</strong>. Tick, edit or remove anything that's wrong. Nothing becomes an answer until you use it.
      </p>
      {site.ahrefs?.thin && <div className="note small">Google doesn't know your site well yet, so research will use your services and places.</div>}
      {list("services", "Services")}
      {list("places", "Places you serve")}
      <div className="card">
        <h3>Competitors</h3>
        <p className="small muted">Sites that rank for the same searches. Directories and marketplaces start unticked.</p>
        {draft.competitors.length === 0 && <p className="small muted">None found.</p>}
        {draft.competitors.map((c: Competitor, i: number) => (
          <label key={c.domain} className="check">
            <input type="checkbox" checked={c.ticked} onChange={() => setDraft({ ...draft, competitors: draft.competitors.map((x: Competitor, j: number) => (j === i ? { ...x, ticked: !x.ticked } : x)) })} />
            <span>
              {c.domain}
              {c.directory && <span className="tag" style={{ marginLeft: 6 }}>Directory</span>}
              {c.keywordsCommon !== null && <span className="tiny muted"> · {c.keywordsCommon} searches in common</span>}
            </span>
          </label>
        ))}
      </div>
      <div className="card small">
        <h3>Also found</h3>
        {draft.headline?.text && <p>Headline: “{draft.headline.text}”</p>}
        {(draft.prices ?? []).length > 0 && <p>Prices: {draft.prices.map((p: Item) => p.text).join("; ")}</p>}
        {(draft.offers ?? []).length > 0 && <p>Offers: {draft.offers.map((p: Item) => p.text).join("; ")}</p>}
        {(draft.proof ?? []).length > 0 && <p>Reviews and testimonials: {draft.proof.length} found</p>}
        {(draft.booking ?? []).length > 0 && <p>How people book: {draft.booking.map((p: Item) => p.text).join("; ")}</p>}
        {site.tracking && Object.keys(site.tracking).length > 0 && (
          <p>
            Tracking: {site.tracking.metaPixel ? "Meta pixel found" : "no Meta pixel found"}, {site.tracking.googleTag ? "Google tag found" : "no Google tag found"}
          </p>
        )}
        <p className="tiny muted">Each item keeps the page it came from{draft.services?.[0]?.page ? ` (for example ${hostOf(draft.services[0].page)})` : ""}.</p>
      </div>
      <button type="button" className="btn primary" disabled={saving} onClick={confirm}>
        {saving ? "Saving..." : "This looks right"}
      </button>
    </div>
  );
}
