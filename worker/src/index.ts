import { Hono } from "hono";
import type { Env } from "./env.ts";
import { core } from "./routes/core.ts";
import { assist } from "./assist/route.ts";
import { research } from "./research/route.ts";
import { admin } from "./admin/routes.ts";
import { scheduled } from "./cron.ts";
import { robotsTxt, servePage, sitemapXml } from "./seo.ts";

export { ResearchWorkflow } from "./research/workflow.ts";

export const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  if (err && typeof err === "object" && "issues" in err) return c.json({ error: "bad_request" }, 400);
  // Logs never hold answers or prompts; only the error message.
  console.error("request failed", c.req.method, new URL(c.req.url).pathname, err instanceof Error ? err.message : "unknown");
  return c.json({ error: "server_error" }, 500);
});

app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
});

app.route("/api", core);
app.route("/api", assist);
app.route("/api", research);
app.route("/api/admin", admin);
app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

app.get("/robots.txt", (c) => c.text(robotsTxt(c.env, c.req.raw), 200, { "Cache-Control": "public, max-age=3600" }));
app.get("/sitemap.xml", (c) => c.body(sitemapXml(c.env, c.req.raw), 200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" }));

// Everything else is the single page app (served from static assets, with each page's head filled in).
app.all("*", (c) => servePage(c.env, c.req.raw));

export default {
  fetch: app.fetch,
  scheduled,
} satisfies ExportedHandler<Env>;
