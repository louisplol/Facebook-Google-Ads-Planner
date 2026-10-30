import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { INDUSTRY_PACKS, packByKey } from "@pmw/engine";
import { useStore } from "../lib/store.tsx";
import { api, ApiError } from "../lib/api.ts";
import { ScanReview, useSiteScan } from "../components/SiteScan.tsx";
import { Turnstile } from "../components/Research.tsx";

const STEPS = ["consent", "company", "industry", "offer", "where", "goal", "spend", "scan"] as const;
type Step = (typeof STEPS)[number];

export const CONSENT_TEXT =
  "Your answers are stored so you can come back to them. The people who run this tool can see what you enter, to improve it. If you add your website, we read its public pages to suggest answers. When you use the writing or research buttons, the answers needed are sent to our service providers to produce results. Don't enter personal details about customers.";

export function Onboarding() {
  const { ws, me, config, patchWorkspace, newWorkspace, reloadMe } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const needsConsent = (me?.user.consentVersion ?? 0) < (config?.consentVersion ?? 2);
  const initial: Step = params.get("step") === "scan" ? "scan" : needsConsent ? "consent" : (STEPS[Math.max(1, ws?.onboarding_step ?? 1)] ?? "company");
  const [step, setStep] = useState<Step>(initial);
  const [form, setForm] = useState<Record<string, any>>({});
  const [err, setErr] = useState<string | null>(null);
  const scan = useSiteScan();

  useEffect(() => {
    if (!ws) void newWorkspace();
  }, [ws, newWorkspace]);

  useEffect(() => {
    if (ws) setForm((f) => ({ company: ws.company ?? "", website: ws.website ?? "", website_owner_confirmed: !!ws.website_owner_confirmed, no_website: !!ws.no_website, industry_pack: ws.industry_pack ?? "", industry_text: ws.industry_text ?? "", offer_line: ws.offer_line ?? "", service_city: ws.service_city ?? "", sell_mode: ws.sell_mode ?? "", audience_type: ws.audience_type ?? "", country: ws.country ?? "AU", currency: ws.currency ?? "AUD", goal: ws.goal ?? "", current_spend: ws.current_spend ?? "", tracking_status: ws.tracking_status ?? "", ...f }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws?.id]);

  if (!ws) return <div className="page muted">Setting up...</div>;
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const i = STEPS.indexOf(step);
  const pack = packByKey(form.industry_pack);

  const go = async (to: Step, save: Record<string, unknown> = {}) => {
    setErr(null);
    try {
      await patchWorkspace({ ...save, onboarding_step: STEPS.indexOf(to) });
      setStep(to);
      window.scrollTo(0, 0);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't save. Check your connection and try again.");
    }
  };

  const finish = async () => {
    await patchWorkspace({ onboarding_done: true, onboarding_step: STEPS.length });
    await reloadMe();
    nav("/workbook/three-cs");
  };

  const progress = (
    <div className="step-count">
      Step {Math.max(1, i)} of {STEPS.length - 1}
    </div>
  );

  return (
    <main className="ob">
      {step !== "consent" && progress}
      {err && <div className="note warn">{err}</div>}

      {step === "consent" && (
        <section>
          <h1>Before you start</h1>
          <div className="card">
            <p style={{ margin: 0 }}>{CONSENT_TEXT}</p>
          </div>
          <p className="small">
            <Link to="/privacy">Read the privacy page</Link>
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              await api.post("/api/me/consent", { version: config?.consentVersion ?? 2 });
              await reloadMe();
              setStep("company");
            }}
          >
            I understand, let's start
          </button>
        </section>
      )}

      {step === "company" && (
        <section>
          <h1>Your business</h1>
          <div className="field">
            <label htmlFor="company">Business name</label>
            <input id="company" className="input" value={form.company} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="website">Website</label>
            <input id="website" className="input" type="url" inputMode="url" placeholder="yourbusiness.com.au" value={form.website} disabled={form.no_website} onChange={(e) => set("website", e.target.value)} />
            <label className="check" style={{ border: 0 }}>
              <input type="checkbox" checked={!!form.website_owner_confirmed} disabled={form.no_website} onChange={(e) => set("website_owner_confirmed", e.target.checked)} />
              <span>This is my business's website</span>
            </label>
            <label className="check" style={{ border: 0 }}>
              <input type="checkbox" checked={!!form.no_website} onChange={(e) => set("no_website", e.target.checked)} />
              <span>I don't have a website yet</span>
            </label>
            <p className="small muted">We read the public pages of your site in the background while you finish, so we can suggest answers. Nothing becomes an answer until you say so.</p>
          </div>
          {scan.needsTurnstile && <Turnstile onToken={(t) => scan.start(t)} />}
          <div className="btn-row">
            <button
              type="button"
              className="btn primary"
              disabled={!form.company?.trim() || (!form.no_website && (!form.website?.trim() || !form.website_owner_confirmed))}
              onClick={async () => {
                await go("industry", { company: form.company.trim(), name: form.company.trim(), website: form.no_website ? "" : form.website.trim(), website_owner_confirmed: !form.no_website && !!form.website_owner_confirmed, no_website: !!form.no_website });
                if (form.no_website) await scan.noWebsite();
                else void scan.start();
              }}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === "industry" && (
        <section>
          <h1>Your industry</h1>
          <p className="muted">This changes the examples you'll see in every field.</p>
          <div className="choice">
            {INDUSTRY_PACKS.map((p) => (
              <label key={p.key} className={form.industry_pack === p.key ? "on" : ""}>
                <input type="radio" name="industry" checked={form.industry_pack === p.key} onChange={() => set("industry_pack", p.key)} />
                <span>
                  {p.label}
                  <span className="detail">{p.description}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="industry_text">In your own words (optional)</label>
            <input id="industry_text" className="input" placeholder="For example: residential electrician" value={form.industry_text} onChange={(e) => set("industry_text", e.target.value)} />
          </div>
          {pack.compliance_notes?.map((n) => (
            <div key={n} className="note tip small">
              {n}
            </div>
          ))}
          <Nav back={() => setStep("company")} next={() => go("offer", { industry_pack: form.industry_pack, industry_text: form.industry_text })} disabled={!form.industry_pack} />
        </section>
      )}

      {step === "offer" && (
        <section>
          <h1>What you sell, in one line</h1>
          <div className="field">
            <label htmlFor="offer_line">What do you sell?</label>
            <input id="offer_line" className="input" placeholder={`Example: ${pack.examples.offer_line}`} value={form.offer_line} onChange={(e) => set("offer_line", e.target.value)} />
          </div>
          <Nav back={() => setStep("industry")} next={() => go("where", { offer_line: form.offer_line })} disabled={!form.offer_line?.trim()} />
        </section>
      )}

      {step === "where" && (
        <section>
          <h1>Where you sell</h1>
          <div className="choice">
            {[
              ["local", "Locally, in a service area"],
              ["national", "Across the country"],
              ["online_service", "Online, as a service or program"],
              ["online_checkout", "Online, through a checkout (online store)"],
            ].map(([v, l]) => (
              <label key={v} className={form.sell_mode === v ? "on" : ""}>
                <input type="radio" name="sell_mode" checked={form.sell_mode === v} onChange={() => set("sell_mode", v)} />
                <span>{l}</span>
              </label>
            ))}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="city">Main city or service area</label>
            <input id="city" className="input" placeholder="For example: Northern suburbs of Brisbane" value={form.service_city} onChange={(e) => set("service_city", e.target.value)} />
          </div>
          <div className="field">
            <div className="label">Who do you sell to?</div>
            <div className="choice">
              {[
                ["b2c", "People and households"],
                ["b2b", "Businesses"],
                ["both", "Both"],
              ].map(([v, l]) => (
                <label key={v} className={form.audience_type === v ? "on" : ""}>
                  <input type="radio" name="aud" checked={form.audience_type === v} onChange={() => set("audience_type", v)} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <select id="currency" className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              {["AUD", "NZD", "USD", "GBP", "CAD", "EUR"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          {form.sell_mode === "online_checkout" && <div className="note assumed small">Online stores get a checkout version of Forecasting (ad, product page, purchase). The nurture and sales call steps are hidden.</div>}
          <Nav
            back={() => setStep("offer")}
            next={() => go("goal", { sell_mode: form.sell_mode, service_city: form.service_city, audience_type: form.audience_type || undefined, currency: form.currency, country: { AUD: "AU", NZD: "NZ", USD: "US", GBP: "GB", CAD: "CA", EUR: "IE" }[form.currency as string] ?? "AU" })}
            disabled={!form.sell_mode}
          />
        </section>
      )}

      {step === "goal" && (
        <section>
          <h1>Your goal</h1>
          <div className="choice">
            {["More enquiries or calls booked", "Fill a program or event", "Grow a new service", "Test paid ads for the first time"].map((g) => (
              <label key={g} className={form.goal === g ? "on" : ""}>
                <input type="radio" name="goal" checked={form.goal === g} onChange={() => set("goal", g)} />
                <span>{g}</span>
              </label>
            ))}
          </div>
          <Nav back={() => setStep("where")} next={() => go("spend", { goal: form.goal })} disabled={!form.goal} />
        </section>
      )}

      {step === "spend" && (
        <section>
          <h1>Where you're at now</h1>
          <div className="field">
            <div className="label">What do you spend on ads now?</div>
            <div className="choice">
              {["Nothing yet", "Under $1,000 a month", "$1,000 to $5,000 a month", "Over $5,000 a month"].map((g) => (
                <label key={g} className={form.current_spend === g ? "on" : ""}>
                  <input type="radio" name="spend" checked={form.current_spend === g} onChange={() => set("current_spend", g)} />
                  <span>{g}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <div className="label">Is tracking set up on your website?</div>
            <div className="choice">
              {["Yes, the Meta pixel is installed", "Yes, Google tracking only", "No", "Not sure"].map((g) => (
                <label key={g} className={form.tracking_status === g ? "on" : ""}>
                  <input type="radio" name="tracking" checked={form.tracking_status === g} onChange={() => set("tracking_status", g)} />
                  <span>{g}</span>
                </label>
              ))}
            </div>
          </div>
          <Nav back={() => setStep("goal")} next={() => go("scan", { current_spend: form.current_spend, tracking_status: form.tracking_status })} disabled={!form.current_spend || !form.tracking_status} />
        </section>
      )}

      {step === "scan" && (
        <section>
          <h1>Here's what we found</h1>
          <ScanReview onDone={finish} />
        </section>
      )}
    </main>
  );
}

function Nav({ back, next, disabled }: { back: () => void; next: () => void; disabled?: boolean }) {
  return (
    <div className="btn-row" style={{ marginTop: 16 }}>
      <button type="button" className="btn" onClick={back}>
        Back
      </button>
      <button type="button" className="btn primary" disabled={disabled} onClick={next}>
        Next
      </button>
    </div>
  );
}
