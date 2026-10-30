// Model registry: id, tier and prices with an as-of date, so cost tracking stays right after a switch.
// Prices are USD per million input / output units, from Anthropic's model comparison table.

export type Tier = "research" | "write" | "check";

export interface ModelInfo {
  id: string;
  inputPerM: number;
  outputPerM: number;
  cacheReadPerM: number;
  asOf: string;
  source: string;
  /** Model notes from Anthropic, applied when building requests */
  notes?: string;
}

const SRC = "Anthropic model comparison table";

export const MODELS: Record<string, ModelInfo> = {
  "claude-opus-5-5": { id: "claude-opus-5-5", inputPerM: 4, outputPerM: 20, cacheReadPerM: 0.2, asOf: "2026-10-29", source: SRC, notes: "Thinking cannot be disabled; set effort explicitly (default medium)." },
  "claude-sonnet-5-5": { id: "claude-sonnet-5-5", inputPerM: 2, outputPerM: 10, cacheReadPerM: 0.2, asOf: "2026-10-29", source: SRC },
  "claude-haiku-5-5": { id: "claude-haiku-5-5", inputPerM: 0.1, outputPerM: 0.5, cacheReadPerM: 0.01, asOf: "2026-10-29", source: SRC, notes: "Omit temperature, top_p and top_k; steer with effort." },
};

/** Web search: $10 per 1,000 searches plus usage. */
export const WEB_SEARCH_PER_SEARCH_USD = { value: 0.01, asOf: "2026-10-29", source: "Anthropic web search tool pricing" };

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Cost in USD for one call. Unknown models are costed at the most expensive known rate so budgets stay safe. */
export function costUsd(modelId: string, usage: Usage, webSearches = 0): number {
  const m = MODELS[modelId] ?? Object.values(MODELS).reduce((a, b) => (a.outputPerM > b.outputPerM ? a : b));
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  return (
    (usage.input_tokens * m.inputPerM + cacheWrite * m.inputPerM * 1.25 + cacheRead * m.cacheReadPerM + usage.output_tokens * m.outputPerM) / 1_000_000 +
    webSearches * WEB_SEARCH_PER_SEARCH_USD.value
  );
}

/** Max output per action (cost control). */
export const MAX_TOKENS: Record<string, number> = {
  suggest: 600,
  refine: 600,
  check: 600,
  ideas: 1200,
  research: 4000,
  default: 1200,
};
