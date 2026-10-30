import type { Section } from "../types.ts";

export const threeCs: Section = {
  id: "three-cs",
  number: 1,
  title: "The 3 C's",
  icon: "⬡",
  accent: "orange",
  part: 1,
  prefix: "c3_",
  video: { start: "01:00:00", end: "01:26:52" },
  summary: "The three stages every campaign must win, and one question that picks Google or Meta.",
  blocks: [
    {
      kind: "cards",
      chip: "Playbook",
      chipTone: "red",
      columns: 3,
      items: [
        { title: "Clicks", tone: "teal", body: "People clicking your ad and landing on your page. You want clicks from the right people, not everyone.", meta: "Measure: Link CTR + cost per click" },
        { title: "Conversions", tone: "gold", body: "The right person completing your form and booking a call. This is where curious becomes interested.", meta: "Measure: opt-in rate + booking rate + show rate" },
        { title: "Close", tone: "red", body: "Getting them to say yes on the sales call. Marketing that supports sales makes closing far easier.", meta: "Measure: close rate + cost per acquisition" },
      ],
    },
    {
      kind: "fields",
      chip: "Google or Meta?",
      chipTone: "teal",
      tone: "navy",
      fields: [
        {
          id: "c3_awareness",
          label: "Think about your ideal customer right now. Which best describes them?",
          type: "choice",
          assists: ["explain_channel"],
          research: "search_demand",
          options: [
            {
              value: "searching",
              label: "They know they have the problem and are actively searching for a solution",
              result: "Search intent is already there. Your job is to show up when they search. Google captures demand; it doesn't create it.",
              detail: "Applies when: problem aware and solution aware. They're already looking.",
            },
            {
              value: "not_searching",
              label: "They have the problem but aren't searching. They don't know a solution like yours exists",
              result: "No one is searching for you because they don't know you exist yet. Meta lets you interrupt the right person and introduce the problem and solution together.",
              detail: "Applies when: problem aware but not solution aware.",
            },
            {
              value: "unaware",
              label: "They have the problem but don't fully recognise it yet. They need to be shown it",
              result: "Create awareness before you capture it. Meta lets you surface the problem for them, then present your solution. Google won't work: no one is searching.",
              detail: "Applies when: not yet problem aware. Classic for coaching, workshops and business services.",
            },
          ],
        },
      ],
    },
    { kind: "custom", component: "SearchDemand" },
  ],
};

export const forecasting: Section = {
  id: "forecasting",
  number: 2,
  title: "Forecasting",
  icon: "⌇",
  accent: "teal",
  part: 1,
  prefix: "fc_",
  video: { start: "01:26:52", end: "01:39:08" },
  summary: "Eight numbers flow through your funnel to monthly and annual revenue.",
  blocks: [
    {
      kind: "custom",
      component: "Forecaster",
      chip: "Interactive forecaster",
      chipTone: "teal",
      lead: "Type your numbers into each field. Red is below benchmark, green is on target, gold is above. Watch how small changes compound into big revenue differences.",
    },
  ],
};

export const tenPrinciples: Section = {
  id: "ten-principles",
  number: 3,
  title: "10 Principles",
  heading: "10 Principles of Advertising",
  icon: "◈",
  accent: "gold",
  part: 1,
  prefix: "pr_",
  video: { start: "01:39:08", end: "02:51:47" },
  summary: "Ten principles to diagnose any problem in your ads, pages or calls.",
  blocks: [
    { kind: "custom", component: "PrinciplesCards" },
    { kind: "note", noteTone: "gold", text: "Use these as a diagnostic lens. When something isn't working, run through the 10 principles and ask which one you're breaking." },
    { kind: "custom", component: "Diagnose" },
  ],
};

export const customerAvatar: Section = {
  id: "customer-avatar",
  number: 4,
  title: "Customer Avatar",
  icon: "⬟",
  accent: "orange",
  part: 1,
  prefix: "av_",
  video: { start: "02:51:48", end: "03:23:00" },
  summary: "Who they are, what they want, what hurts, and what they've already tried.",
  blocks: [
    {
      kind: "fields",
      chip: "Who are they?",
      chipTone: "red",
      columns: 3,
      fields: [
        { id: "av_age_range", label: "Age range", type: "text" },
        { id: "av_location", label: "Location / service area", type: "text", prefillFrom: "ws.service_city" },
        { id: "av_industry", label: "Industry", type: "text" },
        { id: "av_descriptors", label: "2-3 descriptors (what defines them)", type: "textarea", assists: ["suggest", "refine"] },
      ],
    },
    {
      kind: "row",
      blocks: [
        {
          kind: "fields",
          chip: "Towards motivators",
          chipTone: "teal",
          tone: "navy",
          fields: [
            {
              id: "av_towards",
              label: "Towards motivators",
              help: "For each one, ask yourself: why do they want this? Then what happens when they get it? Go at least 2 levels deep. That's where the real emotion lives.",
              type: "rows",
              count: 5,
              rowPlaceholder: "Motivator",
              assists: ["suggest", "go_deeper"],
            },
          ],
        },
        {
          kind: "fields",
          chip: "Away from motivators",
          chipTone: "red",
          tone: "green",
          fields: [
            {
              id: "av_away",
              label: "Away from motivators",
              help: "For each pain: what's the real cost if it's never fixed? Think financial, emotional, identity. The deeper the pain, the stronger the hook.",
              type: "rows",
              count: 5,
              rowPlaceholder: "Pain point",
              assists: ["suggest", "real_cost"],
            },
          ],
        },
      ],
    },
    {
      kind: "fields",
      chip: "Previous attempts",
      chipTone: "gold",
      tone: "brown",
      fields: [
        {
          id: "av_attempts",
          label: "Previous attempts",
          help: "These become your best ad hooks: \"this is different from X because...\" Each one is an objection your marketing needs to answer before it's asked.",
          type: "rows",
          count: 6,
          columns: 2,
          rowPlaceholder: "Attempt",
          assists: ["suggest"],
        },
      ],
    },
    {
      kind: "note",
      noteTone: "grey",
      strong: "Language tip:",
      text: "As you write these motivators and pains, note the exact words and phrases your customers use to describe them. Not your words, theirs. Wrong lingo means instant credibility loss. Use their language word for word in your ads and landing page.",
    },
    { kind: "custom", component: "LanguageBank" },
  ],
};

export const messaging: Section = {
  id: "messaging",
  number: 5,
  title: "Messaging",
  icon: "◇",
  accent: "teal",
  part: 1,
  partAssumed: true,
  prefix: "msg_",
  video: { start: "03:23:00", end: "03:45:39" },
  summary: "Turn your avatar into the headline every later section reuses.",
  blocks: [
    {
      kind: "fields",
      chip: "Thing → Result → Feeling",
      chipTone: "teal",
      lead: "Most businesses only talk about the thing. Great advertisers talk about the feeling. Work through all three.",
      columns: 3,
      fields: [
        { id: "msg_thing", label: "The Thing", help: "What your service actually is", type: "textarea", tone: "plain", assists: ["suggest", "refine"] },
        { id: "msg_result", label: "The Result", help: "Tangible outcomes clients get", type: "textarea", tone: "gold", assists: ["suggest", "refine", "ideas"] },
        { id: "msg_feeling", label: "The Feeling", help: "How they feel when they achieve it", type: "textarea", tone: "red", assists: ["suggest", "ideas"] },
      ],
    },
    { kind: "custom", component: "CurrentHeadline" },
    {
      kind: "fields",
      chip: "Headline drafts",
      chipTone: "gold",
      tone: "navy",
      lead: "Formula: Result + Feeling. Write 3 attempts, pick the most specific one.",
      fields: [
        { id: "msg_headline", label: "Draft", type: "rows", count: 3, rowPlaceholder: "Your attempt", assists: ["suggest", "refine", "ideas", "check"], exampleKey: "msg_headline" },
        { id: "msg_headline_chosen", label: "✓ Your chosen headline", type: "textarea", assists: ["rank_drafts"], exampleKey: "msg_headline" },
        { id: "msg_subheadline", label: "Sub-headline (HOW you achieve the result)", type: "textarea", assists: ["suggest", "refine"] },
      ],
    },
    { kind: "custom", component: "CompetitorMessages" },
  ],
};

export const PART_ONE = [threeCs, forecasting, tenPrinciples, customerAvatar, messaging];
