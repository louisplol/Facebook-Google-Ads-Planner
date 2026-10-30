# Working on this repo

Public repo. Read these before changing anything.

- No personal data, names, emails, domains, keys or account ids in code. All config comes from environment variables (`wrangler.toml.example`, `.dev.vars.example`).
- Never show the reference workbook's original program name anywhere: code, copy, commits or docs. The brand comes only from `BRAND_NAME`.
- Never invent a benchmark or threshold. They live in `packages/engine/src/config/benchmarks.ts` with a source and an as-of date. Open decisions stay `null` until set.
- UI copy: plain Australian English, no em or en dashes, no model names, "tokens", "API" or other tech talk. `npm run lint:copy` checks this.
- Every calculated number shows its formula and inputs, and is labelled your input, benchmark, market data or suggestion.
- Claude, Ahrefs and Browser Rendering are called from the Worker only. Keys never reach the browser.
- Assists never overwrite user text, and never invent testimonials, reviews, statistics, prices or results.
- Research runs only after the website scan is confirmed, or after the user says they have no website yet.
- Tests never call live Claude, Ahrefs or Browser Rendering. Use `setLlmForTests`, `setResearchFetch` and the fixtures in `test/fixtures`.

Layout: `packages/engine` (pure method, maths, content, validators), `worker/src` (Hono API, assist, research, admin), `apps/web` (React app), `migrations` (D1), `e2e` (Playwright), `evals/assist` (live eval set, run by hand).
