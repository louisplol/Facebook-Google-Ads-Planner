import type { Section } from "../types.ts";

export const metaCampaign: Section = {
  id: "meta-campaign",
  number: 11,
  title: "Meta Campaign",
  heading: "Building Your Meta Campaign",
  icon: "⌘",
  accent: "teal",
  part: 4,
  prefix: "mc_",
  video: { start: "08:10:00", end: "09:00:00" },
  summary: "Six rules, then a pre-launch check that reads your whole workbook.",
  blocks: [
    {
      kind: "numbered",
      chip: "Meta campaigns: what you need to know",
      chipTone: "gold",
      items: [
        { title: "Creative diversity is now targeting.", body: "Meta's ad system reads your ad's words, your visuals and your landing page to find the right audience. What you SAY in the ad does more targeting than your audience settings." },
        { title: "Minimum 12 ads.", body: "Meta's ad system rewards creative diversity. One or two ads won't cut it. Build 12 unique ads with different ideas before you launch." },
        { title: "Each ad must be completely unique.", body: "You can't just change the hook on the same video any more. Completely new creative. Different idea, different angle." },
        { title: "The 90/10 spend split is normal.", body: "Meta will put about 90% of budget on 1-2 ads it thinks will win. Leave the others running: they'll often find small niche audiences at very low cost per result." },
        { title: "Advantage+ is your friend now.", body: "Let it do the audience matching. Focus your energy on the creative." },
        { title: "Turn off all automatic creative enhancements.", body: "Optimised Creative Text, Relevant Comments, Related Media, Image Generation: turn them all off. Until proven, they test features on your budget." },
      ],
    },
    {
      kind: "row",
      blocks: [
        {
          kind: "checklist",
          id: "mc_settings",
          title: "Campaign settings",
          chip: "Your campaign settings",
          chipTone: "teal",
          items: [
            { id: "mc_advantage_on", label: "Advantage+ audience is on" },
            { id: "mc_off_text", label: "Optimised Creative Text is off" },
            { id: "mc_off_comments", label: "Relevant Comments is off" },
            { id: "mc_off_media", label: "Related Media is off" },
            { id: "mc_off_image", label: "Image Generation is off" },
          ],
        },
        { kind: "custom", component: "PreLaunch" },
      ],
    },
    { kind: "note", noteTone: "assumed", text: "Campaign objective and the optimisation event weren't in the reference screens. Confirm what to pick before launch." },
  ],
};

export const googleSearch: Section = {
  id: "google-search",
  number: 12,
  title: "Google Search",
  heading: "Google Search Campaign",
  icon: "⌕",
  accent: "gold",
  part: 4,
  isNew: true,
  prefix: "gs_",
  video: null,
  showWhen: { ws: "channel", equals: "google" },
  summary: "For customers already searching: keywords, words to block, and ads within Google's limits.",
  blocks: [
    { kind: "note", noteTone: "assumed", text: "New section, not in the reference workbook. It uses the same principles for people who are already searching." },
    { kind: "custom", component: "GoogleKeywords", chip: "Keywords people type", chipTone: "teal" },
    {
      kind: "fields",
      columns: 2,
      fields: [
        { id: "gs_groups", label: "Ad groups (3-5 themed groups)", type: "textarea", assists: ["group_keywords"] },
        { id: "gs_negatives", label: "Words to block", type: "list", assists: ["suggest_negatives"] },
      ],
    },
    { kind: "row", blocks: [{ kind: "custom", component: "GoogleAds", chip: "Your ads", chipTone: "gold", tone: "navy" }, { kind: "custom", component: "GoogleBudgetCheck" }] },
  ],
};

export const audiences: Section = {
  id: "audiences",
  number: 13,
  title: "Audiences",
  heading: "Creating Audiences",
  icon: "◎",
  accent: "gold",
  part: 4,
  prefix: "au_",
  video: { start: "09:00:00", end: "09:30:00" },
  summary: "Start cold. Add warm audiences once your pixel has 500+ events.",
  blocks: [
    {
      kind: "table",
      chip: "Custom audience reference",
      chipTone: "gold",
      columns: ["Audience", "Best for", "Notes"],
      firstColTones: ["teal", "gold", "gold", "red", "grey"],
      rows: [
        ["All website visitors (180 days)", "Retargeting anyone who's hit your funnel", "Broadest warm audience. Use for social proof and skepticism-addressing ads."],
        ["IG profile engagers (365 days)", "People who've seen your organic content", "Higher trust already. Works well with direct offers."],
        ["Facebook page engagers (365 days)", "Same as above for Facebook", "Combine with IG into one warm ad set."],
        ["Video viewers 10+ seconds (180 days)", "People who actually watched your ads", "Niche but high quality. Good for building out your warm pool early on."],
        ["Customer list (email upload)", "Lookalike source or re-engagement", "Match rate is often low. Need 5k+ for a useful lookalike."],
      ],
    },
    { kind: "note", noteTone: "teal", strong: "Start with cold only.", text: "Add warm audiences once your pixel has 500+ events. Before that, your warm audience is too small to matter." },
    {
      kind: "row",
      blocks: [
        {
          kind: "fields",
          chip: "Where you're at",
          chipTone: "teal",
          fields: [
            { id: "au_pixel_events", label: "Pixel events so far (from Meta Events Manager)", type: "number" },
            { id: "au_customer_list_size", label: "Customer list size", type: "number" },
          ],
        },
        { kind: "custom", component: "AudienceRules" },
      ],
    },
  ],
};

export const PART_FOUR = [metaCampaign, googleSearch, audiences];
