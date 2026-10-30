import type { Section } from "../types.ts";

const STORY = { field: "vsl_type", equals: "story_arc" };
const REVIEW = { field: "vsl_type", equals: "google_review" };

export const adPrinciples: Section = {
  id: "ad-principles",
  number: 8,
  title: "Ad Principles",
  icon: "◉",
  accent: "teal",
  part: 3,
  partAssumed: true,
  prefix: "ap_",
  video: { start: "04:37:00", end: "06:15:00" },
  summary: "The Rule of One, the hook formula, and your 12 ad ideas.",
  blocks: [
    {
      kind: "tiles",
      chip: "The Rule of One",
      chipTone: "teal",
      lead: "Every ad follows ONE idea, ONE story, ONE promise, ONE emotion, ONE call to action. Frankenstein ads (several ideas mashed together) don't work.",
      items: [
        { top: "One", title: "Idea" },
        { top: "One", title: "Story" },
        { top: "One", title: "Promise" },
        { top: "One", title: "Emotion" },
        { top: "One", title: "CTA" },
      ],
      after: "When an ad works, look at it through the Rule of One: what was the idea? What was the emotion? Then find adjacent ideas in the same direction to build more ads.",
    },
    {
      kind: "cards",
      chip: "Hook formula",
      chipTone: "gold",
      tone: "navy",
      lead: "Your hook needs to do 3 things: spark curiosity, use committed language, filter out the wrong people. The hook is 80% of the result.",
      columns: 3,
      items: [
        { title: "Curious (wrong)", tone: "red", quote: "\"Are you struggling to get leads?\"", body: "Too vague. Could be about anything. Cheap clicks, terrible quality." },
        { title: "Committed (right)", tone: "teal", quote: "\"After 2 days in my workshop, business owners stop relying on word of mouth\"", body: "Implies a service. Filters by situation. Sets the expectation of what they'll find." },
        { title: "Financial qualifier", tone: "gold", quote: "\"Despite managing a team, most business owners still rely on referrals\"", body: "Only resonates with people who have a team, so can afford you." },
      ],
    },
    {
      kind: "custom",
      component: "AdIdeas",
      chip: "Your 12 ad ideas",
      chipTone: "red",
      tone: "green",
      lead: "Pull ideas from your customer avatar. Each one follows the Rule of One. You need a minimum of 12 because Meta's ad system rewards creative diversity.",
    },
    { kind: "custom", component: "AdsRunning" },
  ],
};

export const filmingAds: Section = {
  id: "filming-ads",
  number: 9,
  title: "Filming Ads",
  icon: "◈",
  accent: "gold",
  part: 3,
  prefix: "fa_",
  video: { start: "06:15:00", end: "07:00:00" },
  summary: "Every ad uses the same three part structure. Know it cold before you film.",
  blocks: [
    {
      kind: "cards",
      chip: "Ad structure, for every ad",
      chipTone: "teal",
      lead: "Simple 3-part framework. Know this cold before filming.",
      columns: 3,
      items: [
        { number: "01", title: "Hook", tone: "red", body: "Stop the right person from scrolling. Committed language. Filter out the wrong people. This is 80% of the work.", quote: "\"After 2 days in my workshop, business owners stop relying on word of mouth for leads...\"" },
        { number: "02", title: "Prove your point", tone: "gold", body: "Elaborate on the idea. Tell a story. Give a case study. Speak to what they're experiencing: repeat back their internal monologue.", quote: "\"You wake up Monday, check your phone, hoping someone referred you. That's your entire pipeline...\"" },
        { number: "03", title: "Tell them what to do", tone: "teal", body: "One call to action. Always \"click below to learn more\". Never ask for the booking in the ad. You're only selling the next step.", quote: "\"Click below to learn more.\" or \"Click below to see if you're a good fit.\"" },
      ],
    },
    { kind: "custom", component: "Scripts" },
  ],
};

export const vsl: Section = {
  id: "vsl",
  number: 10,
  title: "VSL",
  icon: "◈",
  accent: "orange",
  part: 3,
  prefix: "vsl_",
  video: { start: "07:00:00", end: "08:10:00" },
  summary: "Pick a video type and fill its planner. The structure carries the video.",
  blocks: [
    {
      kind: "fields",
      chip: "Which VSL type suits you?",
      chipTone: "red",
      tone: "navy",
      lead: "Two options. Pick one and build it.",
      fields: [
        {
          id: "vsl_type",
          label: "VSL type",
          type: "choice",
          options: [
            { value: "story_arc", label: "Feedback Story Arc VSL", detail: "5-15 mins. Established offer, existing testimonials, clear pillars" },
            { value: "google_review", label: "Google Review VSL", detail: "2-5 mins. No VSL yet, 5+ reviews, want a quick win", hiddenForCompliance: "health_practitioner" },
          ],
        },
      ],
    },
    {
      kind: "fields",
      chip: "Feedback Story Arc: planner",
      chipTone: "red",
      tone: "green",
      lead: "Work through each part before you film. The structure carries the VSL: talking your way through this plan is all you need to do.",
      bars: true,
      showWhen: STORY,
      fields: [
        { id: "vsl_first30", label: "First 30 seconds: meet them where they're at", help: "Pain points plus proof. What are the 3-4 things going through their head right now? What proof can you flash on screen?", type: "textarea", assists: ["suggest", "refine"] },
        { id: "vsl_pillar1", label: "Feedback Story Arc: Pillar 1", help: "Your first delivery mechanism. Why other solutions failed. What makes yours different. What specifically happens in it.", type: "textarea", assists: ["suggest", "refine"] },
        { id: "vsl_good_problem", label: "The Good Problem", help: "What problem does Pillar 1 create that makes Pillar 2 necessary?", type: "textarea", assists: ["suggest"] },
        { id: "vsl_pillar2", label: "Feedback Story Arc: Pillar 2", help: "How you solve the good problem. What ongoing support looks like.", type: "textarea", assists: ["suggest", "refine"] },
        { id: "vsl_faq", label: "FAQ section: top questions to answer", help: "What are the 5 things people ask before buying? Answer them here so they don't have to ask on the call.", type: "textarea", assists: ["suggest_answers"], research: "buyer_questions" },
      ],
    },
    {
      kind: "numbered",
      chip: "Google Review VSL: planner",
      chipTone: "teal",
      lead: "Open your camera. Pull up your Google reviews. Talk about 5-6 of them one by one. Cut it, add captions, embed it. Done. The formula for each review:",
      showWhen: REVIEW,
      items: [
        { title: "", body: "Read the review name and star rating. Show it on screen as you talk" },
        { title: "", body: "Say what situation they were in before they came to you" },
        { title: "", body: "Say what changed, specifically" },
        { title: "", body: "Quote or paraphrase what they said in the review" },
        { title: "", body: "Move straight to the next review. No filler" },
      ],
    },
    {
      kind: "fields",
      bars: true,
      showWhen: REVIEW,
      fields: [
        { id: "vsl_reviews", label: "Which reviews will you use?", help: "Pick 5-6 of your best Google reviews, ideally from different industries or situations. Paste the key phrases here.", type: "textarea", assists: ["pick_reviews"] },
        { id: "vsl_opening", label: "Your opening line", help: "Don't introduce yourself first. Open with social proof and get into a review within 10 seconds.", type: "textarea", assists: ["suggest"] },
        { id: "vsl_close", label: "Your close", help: "After the last review, one call to action. Don't oversell. Just tell them what to do next.", type: "textarea", assists: ["suggest"] },
      ],
    },
    { kind: "custom", component: "TalkingPoints" },
  ],
};

export const PART_THREE = [adPrinciples, filmingAds, vsl];
