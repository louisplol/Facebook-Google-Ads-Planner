import type { AssistAction } from "../content/types.ts";
import { RUBRICS } from "../method/rubrics.ts";

// One short task instruction per action. The field's label and current text are added by the Worker.

const rubricText = (key: string) =>
  RUBRICS[key]
    .map((r) => `- ${r.id}: ${r.label}`)
    .concat(RUBRICS.general.map((r) => `- ${r.id}: ${r.label}`))
    .join("\n");

export function taskFor(action: AssistAction, fieldId: string): string {
  const base = fieldId.replace(/_\d+$/, "");
  switch (action) {
    case "suggest":
      return "The field is empty. Write 1 to 3 options for it from the context. In each option's note, say in a few words what it was built from. Put the context key it came from in `from`.";
    case "refine":
      return "Improve the user's text. Keep their words where you can. Return exactly 1 option. In `note`, say in one line what you changed.";
    case "ideas":
      return "Write 5 distinct options. Each must come from a different pain or motivator in the context, so they don't sound alike. Put the context key each came from in `from` and a short reason in `note`.";
    case "check": {
      const key = base.startsWith("msg_headline") || base === "lp_headline" ? "headline" : base.startsWith("gs_") ? "google_ad" : "headline";
      return `Check the user's text against each rule below. For each, return pass true or false, and a one line fix when it fails (empty string when it passes). Never give a score.\n${rubricText(key)}`;
    }
    case "go_deeper":
      return "For each motivator the user wrote (or the one given), build a two step chain: ask why they want it (level1), then what happens when they get it (level2). Use their own words. Return up to 5 chains.";
    case "real_cost":
      return "Split this pain into its real cost if it's never fixed: financial, emotional and identity. One short sentence each. No invented numbers.";
    case "rank_drafts":
      return "Rank the user's headline drafts (msg_headline_1 to 3) from most to least specific, with one reason each. `draft` is the draft number.";
    case "explain_forecast":
      return "In three plain sentences, say what the forecast means and which dial to work on first. Use only the engine's numbers and ranking in the context. Do no maths of your own.";
    case "explain_channel":
      return "In two or three plain sentences, explain why the chosen channel suits this business's customers, using the awareness answer and the industry. Don't do maths.";
    case "diagnose":
      return "The user describes what isn't working (or red dials are given). Name the principle being broken (id and title), the funnel stage, the upstream stage to check first (from the engine's upstream map in the context), and one test to run.";
    case "what_to_test":
      return "Explain the first bottleneck in plain words using the principle behind it, and suggest one test. Use only the engine's bottleneck in the context. `stage` is the bottleneck, `checkFirst` what to look at, `test` the one test.";
    case "fill_from_avatar":
      return "Turn each avatar entry (5 towards motivators, 5 away from motivators, 6 previous attempts) into one ad idea, phrased as one idea each. `source` is the avatar key it came from. Up to 16 ideas.";
    case "write_hooks":
      return "Write 3 committed hooks for this ad idea, using the hook formula. At least one must use a financial qualifier; mark it.";
    case "check_hook":
      return "Label the hook curious or committed, say whether it filters out the wrong people, and name any second idea or emotion (a Rule of One break) or empty string. Give a one line fix or empty string.";
    case "check_all_ideas":
      return "Compare the ad ideas (ap_ideas, numbered from 1). Return every pair too alike to count as unique ads, with a short reason. Return an empty list if all are distinct.";
    case "more_like_this":
      return "This idea worked. Using its idea and emotion, return 5 adjacent ideas in the same direction, each a different angle.";
    case "script_idea":
      return "Write a 30 to 60 second ad script in three parts for this idea: hook (use the row's hook if there is one), prove (story, case or their inner voice, using the language bank), cta (exactly \"Click below to learn more.\" or \"Click below to see if you're a good fit.\"). Add shot notes: suggested on-screen captions and b-roll so this ad looks different from the others.";
    case "write_message":
      return "Write this nurture message in the user's voice. Use merge fields {first_name}, {call_time}, {zoom_link}, {vsl_link} where they fit. SMS must fit 160 characters including merge fields. For the testimonials email, only use testimonials the user supplied in bf_testimonials; if there are none, write a placeholder saying [paste 2-3 real testimonials from customers in their industry here]. Never invent testimonials.";
    case "suggest_questions":
      return "Suggest 4 to 6 application form questions that filter out the wrong people. Low commitment first, contact details last. Include a financial qualifier fitting the audience (team size or revenue band for businesses, budget range or timeframe for consumers).";
    case "review_page":
      return `Read the page text in the context and check it against each rule. Return pass or a one line fix.\n${rubricText("page")}`;
    case "check_tracking":
      return "Summarise the tracking findings given as pass or fix per page. Don't guess beyond them.";
    case "pick_reviews":
      return "From the reviews the user pasted, pick the 5 or 6 most varied. For each: reviewer name, star rating if shown, their situation before, what changed specifically, and an exact quote. Never change what a reviewer said. If fewer than 5 reviews are supplied, pick what's there.";
    case "suggest_answers":
      return "Draft short answers to these questions only from what the user has written about their offer. Anything unknown comes back as a gap in square brackets, like [how long does it take?].";
    case "talking_points":
      return "Turn the VSL planner into short prompts to talk through, grouped by part. Not a word for word script.";
    case "group_keywords":
      return "Group the keywords marked include into 3 to 5 themed ad groups. Every included keyword appears in exactly one group.";
    case "suggest_negatives":
      return "Suggest words to block, such as jobs, free, DIY, course, salary and similar, based on the keyword list and what the business doesn't offer.";
    case "which_warm":
      return "Tag which ad ideas suit warm audiences (social proof, skepticism-addressing) with a short reason. `index` is the idea number from 1.";
    case "suggest_followups":
      return "Suggest 4 to 6 follow-up questions for discovery, built from the avatar's 'then what happens?' chains. One question each, open ended.";
    case "tie_downs":
      return "Write 3 tie-down lines for after this pillar, like \"Does that make sense? Could you see yourself using that?\"";
    case "practice_call":
      return "You are playing a prospect on a sales call, built from the avatar (their pains, previous attempts and likely objections). Reply in character in one to three sentences. When the transcript shows the seller has made a two option close, or the user writes END, set done true and give feedback on the five stages: agenda set, one question then silence, recap in their words, tie-downs used, two-option close. Otherwise feedback is an empty list.";
  }
}
