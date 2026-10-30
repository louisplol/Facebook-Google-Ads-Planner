import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { packByKey, visibleSections, type IndustryPack, type Section, type ConditionContext } from "@pmw/engine";
import { api } from "./api.ts";

export interface AppConfig {
  brandName: string;
  videoUrl: string | null;
  assistEnabled: boolean;
  assistConfigured: boolean;
  researchEnabled: boolean;
  turnstileSiteKey: string | null;
  consentVersion: number;
  defaultCurrency: string;
  defaultCountry: string;
}

export interface Me {
  user: { id: string; email: string | null; saved: boolean; consentVersion: number | null };
  workspaces: { id: string; name: string; company: string | null; industry_pack: string | null; onboarding_done_at: string | null; last_section: string | null; updated_at: string }[];
}

export type Workspace = Record<string, any> & {
  id: string;
  name: string;
  industry_pack: string | null;
  funnel_type: "1step" | "2step" | "checkout" | null;
  channel: "meta" | "google" | null;
  audience_type: "b2b" | "b2c" | "both" | null;
  currency: string;
  country: string;
  completed_sections: string[];
};

export interface SiteProfile {
  domain: string | null;
  status: "scanning" | "needs_confirm" | "confirmed" | "failed" | "no_website";
  profile: any;
  tracking: any;
  ahrefs: any;
  error: string | null;
  scanned_at: string | null;
  confirmed_at: string | null;
}

export type Origin = "user" | "suggestion" | "edited_suggestion";

interface Pending {
  value: unknown;
  origin: Origin;
  runId: string | null;
}

interface Store {
  config: AppConfig | null;
  me: Me | null;
  ws: Workspace | null;
  answers: Record<string, unknown>;
  origins: Record<string, Origin>;
  site: SiteProfile | null;
  scenarios: { id: string; name: string; overrides: Record<string, number | null> }[];
  pack: IndustryPack;
  sections: Section[];
  saving: "idle" | "saving" | "saved" | "error";
  loading: boolean;
  setAnswer: (fieldId: string, value: unknown, opts?: { origin?: Origin; runId?: string | null }) => void;
  patchWorkspace: (fields: Record<string, unknown>) => Promise<void>;
  completeSection: (section: string, done: boolean) => Promise<void>;
  track: (type: string, data?: Record<string, unknown>) => void;
  reload: () => Promise<void>;
  reloadMe: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  newWorkspace: (name?: string) => Promise<string>;
  setSite: (s: SiteProfile | null) => void;
  flush: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
const WS_KEY = "pmw_workspace";

const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage can be blocked; the cloud copy is the source of truth */
  }
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [origins, setOrigins] = useState<Record<string, Origin>>({});
  const [site, setSite] = useState<SiteProfile | null>(null);
  const [scenarios, setScenarios] = useState<Store["scenarios"]>([]);
  const [saving, setSaving] = useState<Store["saving"]>("idle");
  const [loading, setLoading] = useState(true);
  const pending = useRef<Map<string, Pending>>(new Map());
  const timer = useRef<number | null>(null);
  const wsId = useRef<string | null>(null);
  // Edit counter per field, so a load that started before an edit never overwrites it.
  const editSeq = useRef(0);
  const lastEdit = useRef<Map<string, number>>(new Map());

  const loadWorkspace = useCallback(async (id: string) => {
    const startedAt = editSeq.current;
    const data = await api.get<{ workspace: Workspace; answers: Record<string, unknown>; origins: Record<string, Origin>; site: SiteProfile | null; scenarios: Store["scenarios"] }>(`/api/workspaces/${id}`);
    const sameWs = wsId.current === id;
    wsId.current = id;
    const editedSince = sameWs ? [...lastEdit.current].filter(([, seq]) => seq > startedAt).map(([k]) => k) : [];
    if (!sameWs) lastEdit.current.clear();
    const keepLocal = <T,>(server: Record<string, T>, local: Record<string, T>) => {
      const next = { ...server };
      for (const k of editedSince) {
        if (k in local) next[k] = local[k];
        else delete next[k];
      }
      return next;
    };
    setWs(data.workspace);
    setAnswers((cur) => keepLocal(data.answers, cur));
    setOrigins((cur) => keepLocal(data.origins, cur));
    setSite(data.site);
    setScenarios(data.scenarios);
    safeSet(WS_KEY, id);
  }, []);

  const reloadMe = useCallback(async () => {
    setMe(await api.get<Me>("/api/me"));
  }, []);

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      // The home page still shows when the visitor session can't start (search crawlers are kept out of it).
      const [cfg, meData] = await Promise.all([api.get<AppConfig>("/api/config"), api.get<Me>("/api/me").catch(() => null)]);
      setConfig(cfg);
      setMe(meData);
      const remembered = safeGet(WS_KEY);
      const pick = meData?.workspaces.find((w) => w.id === remembered) ?? meData?.workspaces[0];
      if (pick) await loadWorkspace(pick.id);
    } finally {
      setLoading(false);
    }
  }, [loadWorkspace]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const flush = useCallback(async () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const id = wsId.current;
    if (!id || pending.current.size === 0) return;
    const batch = [...pending.current.entries()].map(([field_id, p]) => ({ field_id, value: p.value, origin: p.origin, suggestion_run_id: p.runId }));
    pending.current.clear();
    setSaving("saving");
    try {
      const r = await api.put<{ channel: string | null }>(`/api/workspaces/${id}/answers`, { answers: batch });
      if (r.channel) setWs((w) => (w ? { ...w, channel: r.channel as Workspace["channel"] } : w));
      setSaving("saved");
    } catch {
      for (const b of batch) if (!pending.current.has(b.field_id)) pending.current.set(b.field_id, { value: b.value, origin: b.origin as Origin, runId: b.suggestion_run_id ?? null });
      setSaving("error");
    }
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush]);

  const setAnswer = useCallback<Store["setAnswer"]>(
    (fieldId, value, opts) => {
      lastEdit.current.set(fieldId, ++editSeq.current);
      setAnswers((a) => ({ ...a, [fieldId]: value }));
      let origin: Origin = opts?.origin ?? "user";
      setOrigins((o) => {
        // Editing a suggestion keeps its history: it becomes an edited suggestion.
        if (!opts?.origin && (o[fieldId] === "suggestion" || o[fieldId] === "edited_suggestion")) origin = "edited_suggestion";
        const next = { ...o };
        if (origin === "user") delete next[fieldId];
        else next[fieldId] = origin;
        return next;
      });
      pending.current.set(fieldId, { value, origin, runId: opts?.runId ?? null });
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 800);
    },
    [flush],
  );

  const patchWorkspace = useCallback(async (fields: Record<string, unknown>) => {
    const id = wsId.current;
    if (!id) return;
    setWs((w) => (w ? { ...w, ...fields } : w));
    await api.patch(`/api/workspaces/${id}`, fields);
    const fresh = await api.get<{ workspace: Workspace }>(`/api/workspaces/${id}`);
    setWs(fresh.workspace);
  }, []);

  const completeSection = useCallback(async (section: string, done: boolean) => {
    const id = wsId.current;
    if (!id) return;
    const r = await api.post<{ completed: string[] }>(`/api/workspaces/${id}/complete`, { section, done });
    setWs((w) => (w ? { ...w, completed_sections: r.completed } : w));
  }, []);

  const track = useCallback((type: string, data?: Record<string, unknown>) => {
    const id = wsId.current;
    if (id) void api.post(`/api/workspaces/${id}/events`, { type, data }).catch(() => undefined);
  }, []);

  const newWorkspace = useCallback(
    async (name?: string) => {
      await flush();
      const r = await api.post<{ id: string }>("/api/workspaces", { name });
      await loadWorkspace(r.id);
      await reloadMe();
      return r.id;
    },
    [flush, loadWorkspace, reloadMe],
  );

  const switchWorkspace = useCallback(
    async (id: string) => {
      await flush();
      await loadWorkspace(id);
    },
    [flush, loadWorkspace],
  );

  const reload = useCallback(async () => {
    if (wsId.current) await loadWorkspace(wsId.current);
  }, [loadWorkspace]);

  const pack = packByKey(ws?.industry_pack);
  const sections = useMemo(() => {
    const ctx: ConditionContext = { answers, ws: { channel: ws?.channel ?? null, funnel_type: ws?.funnel_type ?? null, industry_pack: ws?.industry_pack ?? null, sell_mode: ws?.sell_mode ?? null, audience_type: ws?.audience_type ?? null }, compliance: pack.compliance };
    return visibleSections(ctx);
  }, [answers, ws, pack]);

  const value: Store = { config, me, ws, answers, origins, site, scenarios, pack, sections, saving, loading, setAnswer, patchWorkspace, completeSection, track, reload, reloadMe, switchWorkspace, newWorkspace, setSite, flush };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}

/** Condition context for the current workspace (for showWhen checks). */
export function useConditionContext(): ConditionContext {
  const { answers, ws, pack } = useStore();
  return { answers, ws: { channel: ws?.channel ?? null, funnel_type: ws?.funnel_type ?? null, industry_pack: ws?.industry_pack ?? null, sell_mode: ws?.sell_mode ?? null, audience_type: ws?.audience_type ?? null }, compliance: pack.compliance };
}
