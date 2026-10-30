// Fixed upstream map used by Diagnose: for each stage, where to look first.
// Follows the Optimising bottleneck checklist (always start at the top of the funnel).

export type Stage = "clicks" | "optin" | "booking" | "show" | "close";

export const UPSTREAM: Record<Stage, { checkFirst: Stage[]; sections: string[]; principle: string }> = {
  clicks: { checkFirst: [], sections: ["ad-principles", "customer-avatar"], principle: "p03" },
  optin: { checkFirst: ["clicks"], sections: ["ad-principles", "messaging", "landing-page"], principle: "p09" },
  booking: { checkFirst: ["optin"], sections: ["landing-page", "build-funnel"], principle: "p04" },
  show: { checkFirst: ["booking"], sections: ["build-funnel", "landing-page"], principle: "p10" },
  close: { checkFirst: ["show"], sections: ["sales", "ad-principles"], principle: "p10" },
};

export const STAGE_LABELS: Record<Stage, string> = {
  clicks: "Clicks",
  optin: "Opt-in",
  booking: "Booking",
  show: "Show rate",
  close: "Close rate",
};
