// Check rubrics: what each Check button tests. The assist returns pass or fix per rule, never a score.

export interface RubricRule {
  id: string;
  label: string;
  principle?: string;
}

export const RUBRICS: Record<string, RubricRule[]> = {
  headline: [
    { id: "specific", label: "Is it specific?" },
    { id: "result", label: "Does it hold a result?" },
    { id: "feeling", label: "Does it hold a feeling?" },
    { id: "customer_language", label: "Does it use your customers' own words?" },
    { id: "committed", label: "Is it committed rather than curious?", principle: "p08" },
  ],
  hook: [
    { id: "committed", label: "Committed, not curious", principle: "p08" },
    { id: "filters", label: "Filters out the wrong people", principle: "p08" },
    { id: "rule_of_one", label: "One idea and one emotion (Rule of One)" },
    { id: "formula", label: "States the problem, hints at a better way" },
  ],
  script: [
    { id: "hook", label: "Hook stops the right person", principle: "p08" },
    { id: "prove", label: "Proves the point with a story, case or their inner voice", principle: "p06" },
    { id: "cta", label: "One call to action that sells only the click", principle: "p07" },
    { id: "rule_of_one", label: "One idea, one emotion" },
  ],
  google_ad: [
    { id: "searcher_words", label: "Uses the searcher's words", principle: "p03" },
    { id: "page_promise", label: "Promises only what the landing page delivers", principle: "p04" },
    { id: "length", label: "Within the character limit" },
  ],
  page: [
    { id: "headline_match", label: "Headline and sub-headline match your chosen ones" },
    { id: "next_step", label: "The page sells only the next step", principle: "p07" },
    { id: "expectation", label: "It meets the expectation your hooks set", principle: "p04" },
    { id: "nothing_extra", label: "It asks for nothing extra", principle: "p09" },
  ],
  general: [
    { id: "plain", label: "Plain words, short sentences" },
    { id: "evidence", label: "No claims, results or guarantees you haven't backed up" },
  ],
};
