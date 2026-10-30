import { replaceDashes, checkAdCta, checkSms, checkGoogleHeadline, checkGoogleDescription, complianceFlags, scriptAsksForBooking, type AssistAction, type ComplianceFlag as EngineFlag } from "@pmw/engine";

// Everything generated is checked here before the user sees it.

/** Swaps em and en dashes in every string, deeply. */
export function deepReplaceDashes<T>(v: T): T {
  if (typeof v === "string") return replaceDashes(v) as T;
  if (Array.isArray(v)) return v.map(deepReplaceDashes) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepReplaceDashes(x)])) as T;
  return v;
}

export interface ValidationResult {
  ok: boolean;
  output: unknown;
  problems: string[];
  flags: { id: string; message: string }[];
}

const strings = (v: unknown): string[] => {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
};

export function validateOutput(action: AssistAction, fieldId: string, raw: unknown, opts: { health?: boolean } = {}): ValidationResult {
  const output = deepReplaceDashes(raw) as Record<string, unknown>;
  const problems: string[] = [];

  if (action === "script_idea") {
    const s = output as { cta?: string; hook?: string; prove?: string };
    const cta = checkAdCta(s.cta ?? "");
    if (!cta.ok) problems.push(`cta: ${cta.reason}`);
    if (scriptAsksForBooking(`${s.hook ?? ""} ${s.prove ?? ""}`)) problems.push("script asks for a booking");
  }

  if (action === "write_message") {
    const m = output as { channel?: string; body?: string };
    if (m.channel === "sms" && !checkSms(m.body ?? "").ok) problems.push("sms over 160 characters");
  }

  if ((action === "write_hooks" || action === "more_like_this" || action === "ideas" || action === "suggest") && fieldId.startsWith("ap_")) {
    for (const t of strings(output)) if (scriptAsksForBooking(t)) problems.push("ad copy asks for a booking");
  }

  // Google ads: drop options that break the character limits; fail only if none are left.
  if ((action === "suggest" || action === "refine" || action === "ideas") && (fieldId === "gs_headlines" || fieldId === "gs_descriptions")) {
    const check = fieldId === "gs_headlines" ? checkGoogleHeadline : checkGoogleDescription;
    const opts2 = (output.options as { text: string }[] | undefined) ?? [];
    const kept = opts2.filter((o) => check(o.text).ok);
    if (!kept.length) problems.push("all options over the character limit");
    output.options = kept;
  }

  const flagged = new Map<string, { id: string; message: string }>();
  for (const t of strings(output)) for (const f of complianceFlags(t, opts)) flagged.set(f.id, f);

  return { ok: problems.length === 0, output, problems, flags: [...flagged.values()] };
}

export type { EngineFlag };
