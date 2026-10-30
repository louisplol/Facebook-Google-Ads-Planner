import { GOOGLE_AD_LIMITS, SMS_SEGMENT_CHARS } from "../config/benchmarks.ts";

// Deterministic validators used by the Worker before any generated text is shown,
// and by the engine for checks that never need an assist.

/** Swaps em and en dashes for a comma or a hyphen. Ranges like 5 to 10 (en dash) become 5-10. */
export function replaceDashes(text: string): string {
  return text
    .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1-$2")
    .replace(/\s*\u2014\s*/g, ", ")
    .replace(/\s+\u2013\s+/g, ", ")
    .replace(/\u2013/g, "-")
    .replace(/,\s*,/g, ",")
    .replace(/^,\s*/, "");
}

export const hasDash = (text: string) => /[\u2013\u2014]/.test(text);

/** Allowed calls to action in an ad: sell only the next step (the click). */
export const ALLOWED_AD_CTAS = [
  "click below to learn more",
  "click below to see if you're a good fit",
  "click below to see if you are a good fit",
  "tap below to learn more",
  "tap below to see if you're a good fit",
  "click the link below to learn more",
  "click below to find out more",
  "tap below to find out more",
  "click below to see how it works",
  "click below to check your price",
  "click below to get your quote",
];

const BOOKING_ASK = /\b(book (a|your|now|in|today)|call (us|me|now|today)|schedule (a|your)|ring us|phone us|give us a call|dm me|message me to book|book a call|book now)\b/i;

export interface CtaCheck {
  ok: boolean;
  reason: string;
}

/** An ad CTA must be in the allowed list and must never ask for the booking or a call (Principle 07). */
export function checkAdCta(cta: string): CtaCheck {
  const c = cta.trim().toLowerCase().replace(/[.!]+$/, "").replace(/’/g, "'");
  if (!c) return { ok: false, reason: "Add a call to action, such as \"Click below to learn more.\"" };
  if (BOOKING_ASK.test(c)) return { ok: false, reason: "The ad asks for a booking or a call. Only sell the next step: the click (Principle 07)." };
  if (!ALLOWED_AD_CTAS.includes(c)) return { ok: false, reason: "Use one simple next step, such as \"Click below to learn more.\"" };
  return { ok: true, reason: "Sells only the next step." };
}

/** Whole-script check: the script must not ask for a booking or call anywhere. */
export function scriptAsksForBooking(text: string): boolean {
  return BOOKING_ASK.test(text);
}

export function checkLength(text: string, max: number): { ok: boolean; length: number; max: number } {
  const length = [...text].length;
  return { ok: length <= max, length, max };
}

export const checkGoogleHeadline = (t: string) => checkLength(t, GOOGLE_AD_LIMITS.headlineChars.value);
export const checkGoogleDescription = (t: string) => checkLength(t, GOOGLE_AD_LIMITS.descriptionChars.value);

/** SMS drafts must fit one 160 character segment. Merge fields count at a typical length. */
export function checkSms(text: string): { ok: boolean; length: number; max: number } {
  const estimated = text
    .replace(/\{first_name\}/g, "Alexandra")
    .replace(/\{call_time\}/g, "Tue 10:30am")
    .replace(/\{zoom_link\}/g, "https://zoom.us/j/12345678901")
    .replace(/\{vsl_link\}/g, "https://example.com/v/abc123");
  return checkLength(estimated, SMS_SEGMENT_CHARS.value);
}

// ---------- Landing page form order (Principle 09) ----------

export interface FormQuestion {
  question: string;
  answerType: string;
  purpose: "qualify" | "commit" | "contact";
}

/** Contact fields must come last. */
export function checkFormOrder(questions: FormQuestion[]): { ok: boolean; firstBadIndex: number | null } {
  let seenContact = false;
  for (let i = 0; i < questions.length; i++) {
    if (questions[i].purpose === "contact") seenContact = true;
    else if (seenContact) return { ok: false, firstBadIndex: i };
  }
  return { ok: true, firstBadIndex: null };
}

// ---------- Compliance flags (warnings, not legal advice) ----------

const GUARANTEE = /\b(guarantee[d]?|100%|risk[- ]free|money[- ]back|never fail|always works|instant results?)\b/i;
const NUMBER_CLAIM = /\b\d+(\.\d+)?\s*(%|x\b|times\b|percent\b)/i;
const CLINICAL = /\b(cure[sd]?|heal(s|ed)?|pain[- ]free|treat(s|ed)? (your|the)|fix(es|ed)? your (back|pain|anxiety|depression)|diagnos(e|is)|clinically proven|recovery in)\b/i;

export interface ComplianceWarning {
  id: "guarantee" | "unevidenced_number" | "clinical_claim";
  message: string;
}

export function complianceFlags(text: string, opts: { health?: boolean } = {}): ComplianceWarning[] {
  const flags: ComplianceWarning[] = [];
  if (GUARANTEE.test(text)) flags.push({ id: "guarantee", message: "This makes a guarantee. Only keep it if you really offer it and can back it up." });
  if (NUMBER_CLAIM.test(text)) flags.push({ id: "unevidenced_number", message: "This quotes a specific result. Only keep it if you have the evidence." });
  if (opts.health && CLINICAL.test(text))
    flags.push({ id: "clinical_claim", message: "This sounds like a clinical outcome claim. Registered health practitioners can't use testimonials or claims about clinical results in advertising." });
  return flags;
}

// ---------- Banned words for user-facing copy ----------

export const BANNED_COPY = [/\btokens?\b/i, /\bAPI\b/, /\bclaude\b/i, /\bopus\b/i, /\bsonnet\b/i, /\bhaiku\b/i, /\bLLM\b/, /\bGPT\b/, /\bAI is thinking\b/i];

export function copyProblems(text: string): string[] {
  const problems: string[] = [];
  if (hasDash(text)) problems.push("em or en dash");
  for (const re of BANNED_COPY) if (re.test(text)) problems.push(`banned word ${re}`);
  return problems;
}
