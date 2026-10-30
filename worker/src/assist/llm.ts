import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { jsonSchemaFor, type Tier, type Usage } from "@pmw/engine";
import type { Env } from "../env.ts";

// All Claude calls go through this interface so tests can swap in a mock.
// Keys stay in the Worker; nothing here is ever sent to the browser.

export interface LlmCall {
  model: string;
  tier: Tier;
  system: string;
  user: string | Anthropic.ContentBlockParam[];
  schema: z.ZodTypeAny;
  maxTokens: number;
}

export interface LlmResult {
  data: unknown;
  usage: Usage;
  stopReason: string | null;
}

export interface ToolLoopCall {
  model: string;
  system: string;
  user: string;
  tools: Anthropic.ToolUnion[];
  maxTokens: number;
  maxTurns: number;
  runTool: (name: string, input: unknown) => Promise<{ content: string; isError?: boolean }>;
  schema: z.ZodTypeAny;
}

export interface ToolLoopResult {
  data: unknown;
  usage: Usage;
  webSearches: number;
  sources: { url: string; title?: string }[];
  turns: number;
}

export interface LlmClient {
  structured(call: LlmCall): Promise<LlmResult>;
  toolLoop(call: ToolLoopCall): Promise<ToolLoopResult>;
}

/** Makes every object strict (all keys required, no extras) as structured outputs expect. */
export function strictSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const s = jsonSchemaFor(schema);
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "object" && n.properties) {
      n.additionalProperties = false;
      n.required = Object.keys(n.properties as object);
    }
    delete n.$schema;
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(walk);
      else walk(v);
    }
  };
  walk(s);
  return s;
}

/** Per-model request shaping, following each model's notes. */
export function shapeFor(model: string, tier: Tier, maxTokens: number) {
  if (model.includes("opus")) {
    // Thinking can't be disabled on this model; keep effort low and leave headroom.
    return { output: { effort: tier === "research" ? ("medium" as const) : ("low" as const) }, thinking: undefined, maxTokens: maxTokens + 2048 };
  }
  if (model.includes("sonnet-5-5")) return { output: { effort: "medium" as const }, thinking: { type: "between_tools" as const }, maxTokens };
  if (model.includes("haiku")) return { output: { effort: "low" as const }, thinking: { type: "disabled" as const }, maxTokens };
  return { output: {}, thinking: undefined, maxTokens };
}

function parseJsonText(content: Anthropic.ContentBlock[]): unknown {
  const text = content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text);
}

export class AnthropicLlm implements LlmClient {
  private client: Anthropic;
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 });
  }

  async structured(call: LlmCall): Promise<LlmResult> {
    const shape = shapeFor(call.model, call.tier, call.maxTokens);
    const stream = this.client.messages.stream({
      model: call.model,
      max_tokens: shape.maxTokens,
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: call.user }],
      output_config: { ...shape.output, format: { type: "json_schema", schema: strictSchema(call.schema) } },
      ...(shape.thinking ? { thinking: shape.thinking } : {}),
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new AssistError("refused");
    if (msg.stop_reason === "max_tokens") throw new AssistError("too_long");
    return { data: parseJsonText(msg.content), usage: msg.usage, stopReason: msg.stop_reason };
  }

  /**
   * Research loop: Claude may call web search (server tool) and our read-only Ahrefs tools.
   * Handles tool_use and pause_turn, and stops after maxTurns.
   */
  async toolLoop(call: ToolLoopCall): Promise<ToolLoopResult> {
    const shape = shapeFor(call.model, "research", call.maxTokens);
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: call.user }];
    const usage: Usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    let webSearches = 0;
    const sources: { url: string; title?: string }[] = [];
    for (let turn = 1; turn <= call.maxTurns; turn++) {
      const last = turn === call.maxTurns;
      const msg = await this.client.messages
        .stream({
          model: call.model,
          max_tokens: shape.maxTokens,
          system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
          messages,
          tools: last ? undefined : call.tools,
          output_config: { ...shape.output, format: { type: "json_schema", schema: strictSchema(call.schema) } },
          ...(shape.thinking ? { thinking: shape.thinking } : {}),
        })
        .finalMessage();
      usage.input_tokens += msg.usage.input_tokens;
      usage.output_tokens += msg.usage.output_tokens;
      usage.cache_read_input_tokens = (usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_read_input_tokens ?? 0);
      usage.cache_creation_input_tokens = (usage.cache_creation_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0);
      webSearches += msg.usage.server_tool_use?.web_search_requests ?? 0;
      for (const b of msg.content) {
        if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
          for (const r of b.content) if (r.type === "web_search_result") sources.push({ url: r.url, title: r.title });
        }
      }
      if (msg.stop_reason === "refusal") throw new AssistError("refused");
      if (msg.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: msg.content });
        continue;
      }
      if (msg.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: msg.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const b of msg.content) {
          if (b.type !== "tool_use") continue;
          const r = await call.runTool(b.name, b.input).catch((e: Error) => ({ content: `Tool failed: ${e.message}`, isError: true }));
          results.push({ type: "tool_result", tool_use_id: b.id, content: r.content, ...(r.isError ? { is_error: true } : {}) });
        }
        messages.push({ role: "user", content: results });
        continue;
      }
      return { data: parseJsonText(msg.content), usage, webSearches, sources, turns: turn };
    }
    throw new AssistError("too_many_turns");
  }
}

export class AssistError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Test hook: tests set a mock client here so no live call is ever made. */
let override: LlmClient | null = null;
export function setLlmForTests(client: LlmClient | null) {
  override = client;
}

export function llmFor(env: Env): LlmClient | null {
  if (override) return override;
  if (!env.ANTHROPIC_API_KEY) return null;
  return new AnthropicLlm(env.ANTHROPIC_API_KEY);
}
