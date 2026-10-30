import { BOTTLENECK_THRESHOLDS as T } from "../config/benchmarks.ts";

export interface FunnelRates {
  ctr: number | null;
  optin: number | null;
  booking: number | null;
  show: number | null;
  close: number | null;
}

export interface BottleneckRow {
  id: number;
  trigger: string;
  check: string;
  sendTo: { section: string; label: string }[];
  assist: string;
  principle: string;
  test: (r: FunnelRates) => boolean;
  thresholdNote: string;
}

const lt = (v: number | null, t: number) => v !== null && v < t;
const gt = (v: number | null, t: number) => v !== null && v > t;

/** The bottleneck checklist, worked top to bottom. Always start at the top of the funnel. */
export const BOTTLENECKS: BottleneckRow[] = [
  {
    id: 1,
    trigger: "Link CTR under 1%",
    check: "Messaging isn't landing. Change the first line of your ads; try different ideas from your avatar. Wrong person or wrong message.",
    sendTo: [
      { section: "ad-principles", label: "Ad Principles" },
      { section: "customer-avatar", label: "Customer Avatar" },
    ],
    assist: "Write hooks, Ideas",
    principle: "p03",
    test: (r) => lt(r.ctr, T.ctrLow.value),
    thresholdNote: `${T.ctrLow.note} (${T.ctrLow.source})`,
  },
  {
    id: 2,
    trigger: "CTR over 2% but poor opt-in",
    check: "Too curious: the ad attracts people who aren't expecting a service. Make the hook more committed by implying what your service is.",
    sendTo: [{ section: "ad-principles", label: "Ad Principles hooks" }],
    assist: "Check all 12 hooks for curious vs committed",
    principle: "p08",
    test: (r) => gt(r.ctr, T.ctrHigh.value) && lt(r.optin, T.poorOptin.value),
    thresholdNote: `CTR over 2% and opt-in under 5%. ${T.poorOptin.note}`,
  },
  {
    id: 3,
    trigger: "Opt-in under 5%",
    check: "Check the headline (Result + Feeling), add a call to action above the form, order the form from low to high psychological resistance, and check physical resistance (is the form above the fold?).",
    sendTo: [
      { section: "messaging", label: "Messaging" },
      { section: "landing-page", label: "Landing Page" },
    ],
    assist: "Check headline, Review my page",
    principle: "p09",
    test: (r) => lt(r.optin, T.optinLow.value),
    thresholdNote: `${T.optinLow.note} (${T.optinLow.source})`,
  },
  {
    id: 4,
    trigger: "Booking under 30%",
    check: "Check calendar availability (too many gaps?) and booking page language (add text like \"last step\"). Chase it upstream: does the form's call to action set the expectation that a booking comes next?",
    sendTo: [
      { section: "landing-page", label: "Landing Page" },
      { section: "build-funnel", label: "Build Funnel item 4" },
    ],
    assist: "Suggest booking copy",
    principle: "p04",
    test: (r) => lt(r.booking, T.bookingLow.value),
    thresholdNote: `${T.bookingLow.note} (${T.bookingLow.source})`,
  },
  {
    id: 5,
    trigger: "Show rate under 65%",
    check: "Check the thank you page message, SMS reminders, replies to confirmation messages, the VSL reminder, and whether testimonials match their industry.",
    sendTo: [{ section: "build-funnel", label: "Build Funnel nurture" }],
    assist: "Shows unticked nurture items; Write this",
    principle: "p10",
    test: (r) => lt(r.show, T.showLow.value),
    thresholdNote: `${T.showLow.note} (${T.showLow.source})`,
  },
  {
    id: 6,
    trigger: "Close rate under 25%",
    check: "First check the sales process: consulting instead of asking questions? Tie-downs in the pitch? Only then look at lead quality (language, ad messaging).",
    sendTo: [
      { section: "sales", label: "Sales" },
      { section: "ad-principles", label: "Ad Principles" },
    ],
    assist: "Practice call, then Check hook",
    principle: "p10",
    test: (r) => lt(r.close, T.closeLow.value),
    thresholdNote: `${T.closeLow.note} (${T.closeLow.source})`,
  },
];
