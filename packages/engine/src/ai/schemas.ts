import { z } from "zod";
import type { AssistAction } from "../content/types.ts";
import type { Tier } from "./models.ts";

// Output schemas. Every assist returns JSON matching one of these so the UI renders cards.

export const OptionsOut = z.object({
  options: z.array(z.object({ text: z.string(), note: z.string(), from: z.string() })),
});

export const CheckOut = z.object({
  results: z.array(z.object({ rule: z.string(), pass: z.boolean(), fix: z.string() })),
});

export const TextOut = z.object({ text: z.string() });

export const DiagnoseOut = z.object({
  principle: z.string(),
  stage: z.string(),
  checkFirst: z.string(),
  test: z.string(),
});

export const RankOut = z.object({ ranking: z.array(z.object({ draft: z.number(), reason: z.string() })) });

export const HooksOut = z.object({ hooks: z.array(z.object({ text: z.string(), financialQualifier: z.boolean() })) });

export const HookCheckOut = z.object({
  label: z.enum(["curious", "committed"]),
  filters: z.boolean(),
  ruleOfOneBreak: z.string(),
  fix: z.string(),
});

export const CheckAllOut = z.object({
  pairs: z.array(z.object({ a: z.number(), b: z.number(), reason: z.string() })),
});

export const IdeasFromAvatarOut = z.object({
  ideas: z.array(z.object({ idea: z.string(), source: z.string() })),
});

export const ScriptOut = z.object({ hook: z.string(), prove: z.string(), cta: z.string(), shotNotes: z.string() });

export const MessageOut = z.object({ channel: z.enum(["sms", "email"]), subject: z.string(), body: z.string() });

export const FormQuestionsOut = z.object({
  questions: z.array(z.object({ question: z.string(), answerType: z.string(), purpose: z.enum(["qualify", "commit", "contact"]) })),
});

export const ReviewPicksOut = z.object({
  picks: z.array(z.object({ reviewer: z.string(), stars: z.string(), before: z.string(), changed: z.string(), quote: z.string() })),
});

export const AnswersOut = z.object({ answers: z.array(z.object({ question: z.string(), answer: z.string() })) });

export const GroupsOut = z.object({ groups: z.array(z.object({ name: z.string(), keywords: z.array(z.string()) })) });

export const WordsOut = z.object({ words: z.array(z.string()) });

export const WarmOut = z.object({ ads: z.array(z.object({ index: z.number(), warm: z.boolean(), reason: z.string() })) });

export const LinesOut = z.object({ lines: z.array(z.string()) });

export const TalkingPointsOut = z.object({ points: z.array(z.object({ part: z.string(), prompts: z.array(z.string()) })) });

export const ChainsOut = z.object({ chains: z.array(z.object({ start: z.string(), level1: z.string(), level2: z.string() })) });

export const CostOut = z.object({ financial: z.string(), emotional: z.string(), identity: z.string() });

export const PracticeOut = z.object({
  reply: z.string(),
  done: z.boolean(),
  feedback: z.array(z.object({ stage: z.string(), ok: z.boolean(), note: z.string() })),
});

export const ExtractOut = z.object({
  services: z.array(z.object({ name: z.string(), page: z.string() })),
  places: z.array(z.object({ name: z.string(), page: z.string() })),
  audience: z.enum(["b2b", "b2c", "both", "unknown"]),
  prices: z.array(z.object({ text: z.string(), page: z.string() })),
  offers: z.array(z.object({ text: z.string(), page: z.string() })),
  proof: z.array(z.object({ kind: z.enum(["testimonial", "review", "case_study"]), text: z.string(), page: z.string() })),
  headline: z.object({ text: z.string(), page: z.string() }),
  ctas: z.array(z.object({ text: z.string(), page: z.string() })),
  booking: z.array(z.object({ text: z.string(), page: z.string() })),
  industryGuess: z.string(),
  offerLine: z.string(),
});

/** What each action returns and which model tier runs it. */
export const ACTION_SPEC: Record<AssistAction, { schema: z.ZodTypeAny; tier: Tier; maxTokens: number; label: string; loading: string }> = {
  suggest: { schema: OptionsOut, tier: "write", maxTokens: 600, label: "Suggest", loading: "Writing a few options..." },
  refine: { schema: OptionsOut, tier: "write", maxTokens: 600, label: "Refine", loading: "Tidying up your words..." },
  ideas: { schema: OptionsOut, tier: "write", maxTokens: 1200, label: "Ideas", loading: "Coming up with ideas..." },
  check: { schema: CheckOut, tier: "check", maxTokens: 600, label: "Check", loading: "Checking against the method..." },
  go_deeper: { schema: ChainsOut, tier: "write", maxTokens: 1200, label: "Go deeper", loading: "Going a level deeper..." },
  real_cost: { schema: CostOut, tier: "write", maxTokens: 600, label: "Real cost", loading: "Working out the real cost..." },
  rank_drafts: { schema: RankOut, tier: "check", maxTokens: 600, label: "Rank my drafts", loading: "Comparing your drafts..." },
  explain_forecast: { schema: TextOut, tier: "check", maxTokens: 600, label: "Explain my forecast", loading: "Reading your numbers..." },
  explain_channel: { schema: TextOut, tier: "check", maxTokens: 600, label: "Explain this for my business", loading: "Thinking about your customers..." },
  diagnose: { schema: DiagnoseOut, tier: "check", maxTokens: 600, label: "Diagnose", loading: "Looking for the cause..." },
  fill_from_avatar: { schema: IdeasFromAvatarOut, tier: "write", maxTokens: 1200, label: "Fill from my avatar", loading: "Turning your avatar into ideas..." },
  write_hooks: { schema: HooksOut, tier: "write", maxTokens: 600, label: "Write hooks", loading: "Writing hooks..." },
  check_hook: { schema: HookCheckOut, tier: "check", maxTokens: 600, label: "Check hook", loading: "Checking your hook..." },
  check_all_ideas: { schema: CheckAllOut, tier: "check", maxTokens: 1200, label: "Check all 12", loading: "Comparing your ideas..." },
  more_like_this: { schema: OptionsOut, tier: "write", maxTokens: 1200, label: "More like this", loading: "Finding ideas nearby..." },
  script_idea: { schema: ScriptOut, tier: "write", maxTokens: 1200, label: "Script this idea", loading: "Writing your script..." },
  write_message: { schema: MessageOut, tier: "write", maxTokens: 600, label: "Write this", loading: "Writing your message..." },
  suggest_questions: { schema: FormQuestionsOut, tier: "write", maxTokens: 600, label: "Suggest questions", loading: "Writing form questions..." },
  review_page: { schema: CheckOut, tier: "check", maxTokens: 1200, label: "Review my page", loading: "Reading your page..." },
  check_tracking: { schema: CheckOut, tier: "check", maxTokens: 600, label: "Check tracking", loading: "Looking for your tracking..." },
  pick_reviews: { schema: ReviewPicksOut, tier: "write", maxTokens: 1200, label: "Pick my best reviews", loading: "Reading your reviews..." },
  suggest_answers: { schema: AnswersOut, tier: "write", maxTokens: 1200, label: "Suggest answers", loading: "Drafting answers..." },
  talking_points: { schema: TalkingPointsOut, tier: "write", maxTokens: 1200, label: "Make my talking points", loading: "Turning your plan into prompts..." },
  group_keywords: { schema: GroupsOut, tier: "write", maxTokens: 1200, label: "Group them", loading: "Grouping your keywords..." },
  suggest_negatives: { schema: WordsOut, tier: "check", maxTokens: 600, label: "Suggest words to block", loading: "Finding words to block..." },
  which_warm: { schema: WarmOut, tier: "check", maxTokens: 600, label: "Which ads for warm?", loading: "Sorting your ads..." },
  suggest_followups: { schema: LinesOut, tier: "write", maxTokens: 600, label: "Suggest follow-ups", loading: "Writing follow-up questions..." },
  tie_downs: { schema: LinesOut, tier: "write", maxTokens: 600, label: "Write tie-downs", loading: "Writing tie-downs..." },
  what_to_test: { schema: DiagnoseOut, tier: "check", maxTokens: 600, label: "What should I test next?", loading: "Looking at your numbers..." },
  practice_call: { schema: PracticeOut, tier: "write", maxTokens: 600, label: "Practice call", loading: "Thinking..." },
};

export function jsonSchemaFor(schema: z.ZodTypeAny): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
}
