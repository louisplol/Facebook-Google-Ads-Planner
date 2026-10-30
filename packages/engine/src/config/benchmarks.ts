// Every benchmark and threshold used by the app lives here, with a source and an as-of date.
// Never add a number without both. Values marked `pending` are open decisions and stay null
// (the feature that uses them stays quiet) until the owner sets them.

export interface Sourced<T> {
  value: T;
  source: string;
  asOf: string;
  note?: string;
  /** True when the plan lists this as an open decision and the value is the plan's stated default. */
  defaultPendingDecision?: boolean;
}

export const COURSE_SOURCE = "Course workbook (reference screenshots)";
export const COURSE_AS_OF = "2026-10-29";

const course = <T>(value: T, note?: string, defaultPendingDecision?: boolean): Sourced<T> => ({
  value,
  source: COURSE_SOURCE,
  asOf: COURSE_AS_OF,
  ...(note ? { note } : {}),
  ...(defaultPendingDecision ? { defaultPendingDecision } : {}),
});

/** A band for colouring a rate: red below `low`, green from low to high, gold above `high`. */
export interface Band {
  low: number;
  high: number | null;
  inverted?: boolean;
  hint: string;
}

/** Forecasting hints and colour bands. Rates are fractions (0.01 = 1%). */
export const FORECAST_BENCHMARKS = {
  dailyBudget: course({ hint: "Start $30-50/day", low: 30, high: 50 }),
  cpmB2C: course({ hint: "B2C about $40", typical: 40 }),
  cpmB2B: course({ hint: "B2B about $70", typical: 70 }),
  ctr: course<Band>({ low: 0.01, high: 0.02, hint: "1-2% is good" }),
  optin: course<Band>({ low: 0.05, high: 0.2, hint: "5-20% typical" }),
  booking: course<Band>({ low: 0.3, high: 0.5, hint: "30-50% target (2-step only)" }),
  // "About 70% target". Red below the 65% bottleneck line is the plan's suggested default (Decision 6).
  show: course<Band>(
    { low: 0.65, high: 0.7, hint: "About 70% target" },
    "Red below 65% uses the Optimising bottleneck line; gold above 70%.",
    true,
  ),
  close: course<Band>({ low: 0.3, high: 0.45, hint: "30-45% target" }),
} as const;

/**
 * CPM colouring is inverted (lower is better). The plan leaves exact bands open (Decision 6).
 * Default: green at or below the B2C/B2B typical figure, red above it. No gold band.
 */
export const CPM_COLOUR_RULE = course(
  { rule: "at_or_below_typical_is_green" as const },
  "Exact CPM bands are an open decision; default is green at or below the typical figure, red above.",
  true,
);

/** Benchmark midpoints used by "Biggest dial" (headroom to midpoint). */
export function bandMidpoint(b: Band): number {
  return b.high === null ? b.low : (b.low + b.high) / 2;
}

/** Bottleneck checklist thresholds (Optimising). Rates are fractions. */
export const BOTTLENECK_THRESHOLDS = {
  ctrLow: course(0.01, "Link CTR < 1%"),
  ctrHigh: course(0.02, "CTR > 2%"),
  // Row 2 gives no number for "poor opt-in"; the plan's default reuses row 3's line.
  poorOptin: course(0.05, "Default: under 5% (same as row 3). Open decision.", true),
  optinLow: course(0.05, "Opt-in < 5%"),
  bookingLow: course(0.3, "Booking < 30%"),
  showLow: course(0.65, "Show rate < 65%"),
  closeLow: course(0.25, "Close rate < 25%"),
} as const;

/** Campaign playbook rules (Optimising). */
export const PLAYBOOK_RULES = {
  considerPausingMultiple: course(2, "Amber at 2x target with zero results. App's reading of '2-3x'. Open decision.", true),
  pauseMultiple: course(3, "Red at 3x target with zero results. App's reading of '2-3x'. Open decision.", true),
  lowSpend: course("below_median" as const, "'Low spend' read as below the median ad's spend. Open decision.", true),
  tiredFrequency: course(2, "Frequency above 2 on cold audiences"),
  reviewDaysMin: course(7, "Review every 7-14 days"),
  reviewDaysMax: course(14, "Review every 7-14 days"),
} as const;

/** Audiences rules. */
export const AUDIENCE_RULES = {
  warmMinPixelEvents: course(500, "Add warm audiences once the pixel has 500+ events"),
  lookalikeMinList: course(5000, "Need 5k+ for a useful lookalike"),
} as const;

/** Forecast time conversions, as the reference workbook does them (Decision 7 default: keep the reference). */
export const TIME = {
  daysPerMonth: course(30.4, "Monthly spend = daily x 30.4"),
  daysPerYear: course(365, "Annual spend = daily x 365 (reference); other annual figures are monthly x 12", true),
  monthsPerYear: course(12),
} as const;

/** Ad Principles: minimum number of unique ads. */
export const MIN_AD_IDEAS = course(12, "Meta's ad system rewards creative diversity; minimum 12");

/** Google Search ad limits (Google Ads responsive search ads). */
export const GOOGLE_AD_LIMITS = {
  headlineChars: { value: 30, source: "Google Ads responsive search ad limits", asOf: COURSE_AS_OF },
  maxHeadlines: { value: 15, source: "Google Ads responsive search ad limits", asOf: COURSE_AS_OF },
  descriptionChars: { value: 90, source: "Google Ads responsive search ad limits", asOf: COURSE_AS_OF },
  maxDescriptions: { value: 4, source: "Google Ads responsive search ad limits", asOf: COURSE_AS_OF },
} as const;

/** One SMS segment (GSM-7). */
export const SMS_SEGMENT_CHARS = { value: 160, source: "GSM-7 single SMS segment", asOf: COURSE_AS_OF } as const;

/**
 * Open decisions with no stated default value. They stay null and the feature that needs
 * them shows "not set yet" rather than guessing.
 */
export const PENDING = {
  /** 3 C's: monthly searches above which Google "could work too". Owner sets this. */
  searchDemandThreshold: { value: null as number | null, source: "Owner decision (pending)", asOf: COURSE_AS_OF },
  /** USD to AUD for Ahrefs cost per click. Market data; owner sets with its date. */
  usdToAud: { value: null as number | null, source: "Owner decision (pending)", asOf: COURSE_AS_OF },
} as const;
