// Copy rules: no em or en dashes anywhere in source, and no tech talk or model names in the web app.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["apps/web/src", "packages/engine/src", "worker/src", "migrations", "README.md", "evals"];
const SKIP = new Set(["node_modules", "dist", ".wrangler"]);
const DASH = /[–—]/;
// Checked only in user-facing web copy (string literals and JSX text). The privacy page names providers on purpose.
const TECH = /(["'>`]|^)[^"'<`]*\b(tokens?|API|Claude|Opus|Sonnet|Haiku|LLM|GPT|AI is thinking)\b/;
const TECH_ALLOWED = new Set(["apps/web/src/pages/Privacy.tsx"]);

const files = [];
const walk = (p) => {
  if (SKIP.has(path.basename(p))) return;
  const st = statSync(p);
  if (st.isDirectory()) for (const f of readdirSync(p)) walk(path.join(p, f));
  else if (/\.(tsx?|md|sql|mjs|json)$/.test(p)) files.push(p.replace(/\\/g, "/"));
};
for (const r of ROOTS) {
  try {
    walk(r);
  } catch {
    /* missing root */
  }
}

const problems = [];
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (DASH.test(line)) problems.push(`${f}:${i + 1} em or en dash`);
    if (f.startsWith("apps/web/src") && !f.includes("/admin/") && !TECH_ALLOWED.has(f)) {
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
      if (/^\s*(import|export \* from|\*)/.test(code)) return;
      if (/\/api\//.test(code) && !/>[^<]*\bAPI\b/.test(code)) return;
      if (TECH.test(code)) problems.push(`${f}:${i + 1} tech talk: ${code.trim().slice(0, 100)}`);
    }
  });
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} copy problem(s)`);
  process.exit(1);
}
console.log(`Copy rules pass (${files.length} files)`);
