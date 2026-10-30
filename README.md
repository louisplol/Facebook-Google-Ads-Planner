# Facebook and Google Ads Planner

Free, open source Facebook and Google ads planner for small businesses. Plan budgets, write ads and landing pages, forecast leads and measure results.

The app takes any business owner through a 14 step paid marketing method, from "Google or Meta?" to the sales call. Every step is backed by the owner's own numbers, real market data and writing help on tap.

The brand name is configuration, not code: set `BRAND_NAME`.

## Run it locally

Needs Node 22 or later.

```bash
npm install
npm run dev
```

`npm run dev` creates `wrangler.toml` and `.dev.vars` from their examples on first run, applies the database migrations to a local database, and serves the app and the API at http://localhost:5173 (health check: `/api/health`). If another project already uses 5173, set `PORT`, for example `PORT=5174 npm run dev`; tests and `scripts/screenshots.mjs` read it too.

With no keys in `.dev.vars`, the whole workbook works; the writing and research buttons say they aren't connected. Add keys to turn them on:

| Variable | What it turns on |
| --- | --- |
| `ANTHROPIC_API_KEY` | Suggest, Refine, Ideas, Check and the other writing help |
| `AHREFS_API_KEY` | Search volume, cost per click, competitors |
| `CF_ACCOUNT_ID`, `CF_BROWSER_TOKEN` | Reading websites built with JavaScript (website scan, page checks) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sign-in emails. Without them, the link is shown on screen in local development |

### The admin area

Open http://localhost:5173/admin. Locally it asks for the `ADMIN_DEV_TOKEN` from your `.dev.vars` (generated for you on first run). It shows every workspace, answer, scenario, event, writing help run and research run, read only. Load demo data with `npm run db:seed:local`.

In production the dev token is ignored. Put Cloudflare Access in front of `/admin*` and `/api/admin*`, then set `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` and `ADMIN_EMAILS`. The Worker checks the Access token itself and only lets in the emails listed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local app and API |
| `npm test` | Unit and route tests (no live services) |
| `npm run coverage` | Tests with coverage (100% lines on the calculators) |
| `npm run e2e` | Browser tests on phone and desktop sizes |
| `npm run lint:copy` | Copy rules: no em or en dashes, no tech talk in the app |
| `npm run typecheck` | Types |
| `npm run eval:assist` | The 40 prompt eval set against the live writing model. Costs money; run by hand before changing models |
| `npm run deploy` | Build and deploy to Cloudflare |

## Deploy your own

1. `npx wrangler login`
2. `npx wrangler d1 create pmw` and put the id in `wrangler.toml`
3. `npx wrangler r2 bucket create pmw-uploads` and add a 7 day lifecycle rule
4. `npx wrangler d1 migrations apply DB --remote`
5. Set secrets: `npx wrangler secret put ANTHROPIC_API_KEY` (and `AHREFS_API_KEY`, `CF_BROWSER_TOKEN`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `SESSION_SECRET`, `ADMIN_EMAILS`, `ALERT_EMAIL`)
6. Set `BRAND_NAME`, `APP_URL`, `TURNSTILE_SITE_KEY`, `EMAIL_FROM`, `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `wrangler.toml`
7. `npm run deploy`

## Layout

```
packages/engine/   method content, calculators, benchmarks (with sources), industry packs, validators
worker/src/        API (Hono on Cloudflare Workers), writing help, research, admin
apps/web/          the web app (React)
migrations/        database schema (D1)
e2e/               browser tests
evals/assist/      fixed eval set for the writing help
```

## Licence

MIT
