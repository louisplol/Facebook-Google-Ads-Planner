export interface Principle {
  id: string;
  number: string;
  title: string;
  idea: string;
}

/** The 10 principles: a diagnostic lens, and the rubric behind every Check button. */
export const PRINCIPLES: Principle[] = [
  { id: "p01", number: "01", title: "Art vs Science", idea: "Everything is measurable, but advertising is also art. Run experiments; let numbers decide." },
  { id: "p02", number: "02", title: "Dials not Switches", idea: "Nothing is simply working or not. Find the dial (CTR, opt-in, show rate) and turn it." },
  { id: "p03", number: "03", title: "Meet Them Where They're At", idea: "Speak to where the customer is now; match their awareness level." },
  { id: "p04", number: "04", title: "Set Expectations", idea: "The ad sets expectations the landing page must meet, at every step." },
  { id: "p05", number: "05", title: "Winning Hearts and Minds", idea: "People buy on emotion and justify with logic; balance both." },
  { id: "p06", number: "06", title: "Constructing Your Argument", idea: "Marketing is debating at scale; give several reasons, not one." },
  { id: "p07", number: "07", title: "Only Selling the Next Step", idea: "The ad sells the click, the page sells the opt-in, the booking page sells the booking." },
  { id: "p08", number: "08", title: "Curious vs Committed", idea: "Curious language gets cheap, poor clicks; committed language filters, and that's good." },
  { id: "p09", number: "09", title: "Physical and Psychological Resistance", idea: "Every click, keystroke, scroll and moment of doubt costs conversions." },
  { id: "p10", number: "10", title: "Chasing Problems Upstream", idea: "A low close rate may be a discovery problem; a low show rate may be a landing page problem." },
];

export const principleById = (id: string) => PRINCIPLES.find((p) => p.id === id);
