import type { Section } from "../types.ts";

export const sales: Section = {
  id: "sales",
  number: 14,
  title: "Sales",
  icon: "◇",
  accent: "orange",
  part: 5,
  prefix: "sa_",
  video: { start: "09:30:00", end: "10:20:00" },
  showWhen: { ws: "funnel_type", notEquals: "checkout" },
  summary: "Four mindset tips and a five stage call, turned into your own call sheet.",
  blocks: [
    {
      kind: "numbered",
      chip: "Mindset tips",
      chipTone: "red",
      items: [
        { title: "Think about where they'd be if you didn't close them.", body: "If your service genuinely helps people, failing to close is a disservice to them. It's not about the transaction." },
        { title: "Therapist, not consultant.", body: "Ask questions. Let them talk. The more they say out loud, the more they commit to being someone who needs to fix this. Don't give answers: ask why." },
        { title: "Process goals, not outcome goals.", body: "Focus on: given what they just said, what is the best next question to ask?" },
        { title: "Don't win the argument and lose the sale.", body: "You can be logically right and still not close. Emotions make the decision. Logic justifies it after." },
      ],
    },
    {
      kind: "steps",
      chip: "Sales call structure: overview",
      chipTone: "gold",
      tone: "navy",
      lead: "Five stages, always in this order. The biggest mistake is skipping straight to the pitch.",
      items: [
        { title: "Open", time: "30 sec", body: "Set the agenda before anything else. Tell them exactly what will happen in the call: questions, walkthrough, numbers, decision. Gets them out of fight or flight and into listening mode." },
        { title: "Discover", time: "10-15 min", body: "Ask one question, then stop talking. \"Give me some context: what's been happening and what made you book this?\" You're a therapist here, not a consultant." },
        { title: "Recap", time: "30-60 sec", body: "Mirror back the most painful things they said, word for word. Don't add to it. Don't soften it. This is when the emotion peaks." },
        { title: "Pitch", time: "10-15 min", body: "Walk through your two pillars. For each one: what it is, why other solutions failed, why yours is different. After each, ask a tie-down: \"Does that make sense? Could you see yourself using that?\"" },
        { title: "Close", time: "2-5 min", body: "Always two options, both a yes. \"We can do this as one payment at $X, or split over 3 months at $Y/month. Of the two, which suits you better?\" Never open-ended. Never ask if they want to proceed." },
      ],
    },
    {
      kind: "fields",
      chip: "Your call",
      chipTone: "teal",
      lead: "Added by this app: your own lines for each stage. Objection handling isn't in the reference screens.",
      columns: 2,
      fields: [
        { id: "sa_agenda", label: "Your opening agenda line", type: "textarea", assists: ["suggest"] },
        { id: "sa_discover", label: "Your discovery question and follow-ups", type: "list", assists: ["suggest_followups"] },
        { id: "sa_pillar", label: "Pitch notes", type: "rows", count: 2, assists: ["refine", "tie_downs"], prefillFrom: "vsl_pillar" },
        { id: "sa_objections", label: "Objections you hear", type: "list", assists: ["suggest_answers"] },
        { id: "sa_plan_uplift", label: "Extra charged for paying over 3 months", type: "percent" },
      ],
    },
    { kind: "row", blocks: [{ kind: "custom", component: "CloseOptions" }, { kind: "custom", component: "CallSheet" }] },
    { kind: "custom", component: "PracticeCall" },
  ],
};

export const optimising: Section = {
  id: "optimising",
  number: 15,
  title: "Optimising",
  icon: "◈",
  accent: "teal",
  part: 6,
  prefix: "op_",
  video: { start: "10:20:00", end: "11:45:00" },
  summary: "Find the first bottleneck, then flag each ad with the campaign playbook.",
  blocks: [
    {
      kind: "custom",
      component: "Bottlenecks",
      chip: "Bottleneck checklist: work through in order",
      chipTone: "teal",
      lead: "Always start at the top of the funnel. A low close rate is often a show rate problem. A low show rate is often a landing page problem.",
    },
    {
      kind: "numbered",
      chip: "Optimising campaigns: playbook",
      chipTone: "red",
      tone: "navy",
      items: [
        { title: "Use the Performance and Clicks view.", body: "Shows Link CTR and cost per result together: the only metrics that matter at ad level." },
        { title: "Sort by amount spent, high to low.", body: "Look at your biggest spenders first. These are eating your budget and need to earn it." },
        { title: "Kill the outliers: high spend, no results.", body: "If an ad has spent 2-3x your target cost per result with no conversions, pause it." },
        { title: "Low spend + low cost per result = leave it.", body: "These small pocket audiences are finding niche segments. They'll spend slowly but efficiently. Don't touch them." },
        { title: "Find your winners, then find adjacent ideas.", body: "Take the ideas from your winning ads, and find adjacent ideas to create more ads." },
        { title: "Watch frequency on cold audiences.", body: "Frequency above 2 on cold means they've seen it too many times. Dial the budget back. Make new ads." },
        { title: "Review every 7-14 days.", body: "Not daily. Not hourly. Daily checking just creates anxiety and bad decisions." },
      ],
    },
    { kind: "custom", component: "Playbook", chip: "Your ads", chipTone: "gold" },
  ],
};

export const PART_FIVE_SIX = [sales, optimising];
