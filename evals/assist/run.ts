// Live eval runner. Costs real money: run by hand only, never in CI or tests.
//   ANTHROPIC_API_KEY=... AI_MODEL_WRITE=claude-sonnet-5-5 npm run eval:assist
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ACTION_SPEC, taskFor, costUsd } from "@pmw/engine";
import { AnthropicLlm } from "../../worker/src/assist/llm.ts";
import { validateOutput } from "../../worker/src/assist/validate.ts";
import { CASES, CONTEXTS } from "./prompts.ts";

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("Set ANTHROPIC_API_KEY to run the eval set.");
  process.exit(1);
}
const models = { write: process.env.AI_MODEL_WRITE || "claude-sonnet-5-5", check: process.env.AI_MODEL_CHECK || "claude-haiku-5-5", research: process.env.AI_MODEL_RESEARCH || "claude-opus-5-5" };
const system = readFileSync(new URL("../../packages/engine/src/ai/prompts/method-pack.md", import.meta.url), "utf8");
const llm = new AnthropicLlm(key);

const rows: string[] = [];
let pass = 0;
let cost = 0;
for (const c of CASES) {
  const spec = ACTION_SPEC[c.action];
  const model = models[spec.tier];
  const ctx = Object.entries(CONTEXTS[c.industry])
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const user = `<context>\n${ctx}\n</context>\n<field id="${c.fieldId}"></field>\n<current_text>${c.text ?? ""}</current_text>${c.extra ? `\n<extra>${JSON.stringify(c.extra)}</extra>` : ""}\n\n<task>${taskFor(c.action, c.fieldId)}</task>`;
  let ok = false;
  let note = "";
  try {
    const r = await llm.structured({ model, tier: spec.tier, system, user, schema: spec.schema, maxTokens: spec.maxTokens });
    cost += costUsd(model, r.usage);
    const parsed = spec.schema.safeParse(r.data);
    const v = parsed.success ? validateOutput(c.action, c.fieldId, parsed.data) : null;
    const text = JSON.stringify(v?.output ?? r.data).toLowerCase();
    const banned = (c.expect.mustNotContain ?? []).filter((b) => text.includes(b));
    ok = !!parsed.success && !!v?.ok === c.expect.validators && banned.length === 0;
    note = !parsed.success ? "schema" : !v?.ok ? v!.problems.join("; ") : banned.length ? `contains ${banned.join(", ")}` : "";
    rows.push(`## ${c.id} (${c.action}, ${model}) ${ok ? "PASS" : "FAIL"} ${note}\n\n\`\`\`json\n${JSON.stringify(v?.output ?? r.data, null, 2)}\n\`\`\`\n`);
  } catch (e) {
    note = e instanceof Error ? e.message : "error";
    rows.push(`## ${c.id} ERROR ${note}\n`);
  }
  if (ok) pass++;
  console.log(`${ok ? "PASS" : "FAIL"} ${c.id} ${note}`);
}

mkdirSync("evals/assist/reports", { recursive: true });
const file = `evals/assist/reports/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.md`;
writeFileSync(file, `# Assist eval\n\nModels: ${JSON.stringify(models)}\nPassed ${pass} of ${CASES.length}. Cost about $${cost.toFixed(3)}.\n\nRead every output below before switching models.\n\n${rows.join("\n")}`);
console.log(`\n${pass} of ${CASES.length} passed. Report: ${file}`);
process.exit(pass === CASES.length ? 0 : 1);
