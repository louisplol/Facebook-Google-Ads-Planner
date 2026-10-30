import { describe, it, expect } from "vitest";
import { pageMeta, SEO_TAGLINE } from "@pmw/engine";
import { app } from "../src/index.ts";
import { testEnv } from "../../test/helpers.ts";
import type { Env } from "../src/env.ts";

const SHELL = `<!doctype html><html lang="en-AU"><head>
    <meta name="description" content="default" />
    <title>Default</title>
  </head><body><div id="root"></div></body></html>`;

// Stands in for the static assets binding: every page path returns the app shell.
const assets = { fetch: async () => new Response(SHELL, { headers: { "content-type": "text/html; charset=utf-8" } }) } as unknown as Fetcher;
const prodEnv = (over: Partial<Env> = {}) => testEnv({ ENVIRONMENT: "production", APP_URL: "https://ads.example.com", BRAND_NAME: "Test Brand", ASSETS: assets, ...over });
const get = (path: string, env: Env) => app.request(`http://localhost${path}`, {}, env);

describe("page meta", () => {
  it("indexes only the public pages", () => {
    expect(pageMeta("/", "B")).toMatchObject({ title: `${SEO_TAGLINE} | B`, index: true });
    expect(pageMeta("/privacy/", "B")).toMatchObject({ title: "Privacy | B", index: true });
    expect(pageMeta("/workbook/three-cs", "B").index).toBe(false);
    expect(pageMeta("/workbook/three-cs", "B").title).toMatch(/ \| B$/);
    expect(pageMeta("/admin/insights", "B")).toMatchObject({ title: "Admin | B", index: false });
    expect(pageMeta("/nowhere", "B")).toMatchObject({ title: "B", index: false });
  });
  it("titles and descriptions fit search results", () => {
    const m = pageMeta("/", "Paid Marketing Workbook");
    expect(SEO_TAGLINE.length).toBeLessThanOrEqual(60);
    expect(m.description.length).toBeGreaterThanOrEqual(120);
    expect(m.description.length).toBeLessThanOrEqual(160);
  });
});

describe("home page head", () => {
  it("writes title, description, canonical, social preview and structured data", async () => {
    const r = await get("/?saved=1", prodEnv());
    const html = await r.text();
    expect(r.headers.get("x-robots-tag")).toBeNull();
    expect(html).toContain(`<title>${SEO_TAGLINE} | Test Brand</title>`);
    expect(html.match(/<meta name="description"/g)).toHaveLength(1);
    expect(html).not.toContain('content="default"');
    expect(html).toContain('<link rel="canonical" href="https://ads.example.com/" />');
    expect(html).toContain('<meta property="og:image" content="https://ads.example.com/og.png" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain('<meta name="robots" content="index, follow, max-image-preview:large" />');
    const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)![1]!);
    expect(ld).toMatchObject({ "@type": "WebApplication", name: "Test Brand", url: "https://ads.example.com/" });
  });
  it("escapes the brand", async () => {
    const html = await (await get("/", prodEnv({ BRAND_NAME: `A "B" <C>` }))).text();
    expect(html).toContain("A &quot;B&quot; &lt;C&gt;</title>");
    expect(html).not.toContain("<C>");
  });
  it("falls back to the request address without APP_URL", async () => {
    const html = await (await get("/privacy", prodEnv({ APP_URL: "" }))).text();
    expect(html).toContain('<link rel="canonical" href="http://localhost/privacy" />');
  });
});

describe("private pages", () => {
  it("are noindex with no canonical or social preview", async () => {
    for (const path of ["/workbook/three-cs", "/plan", "/settings", "/admin"]) {
      const r = await get(path, prodEnv());
      const html = await r.text();
      expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
      expect(html).not.toContain("canonical");
      expect(html).not.toContain("og:image");
    }
  });
  it("hides every page outside production", async () => {
    const r = await get("/", prodEnv({ ENVIRONMENT: "development" }));
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("passes non page files through untouched", async () => {
    const env = prodEnv({ ASSETS: { fetch: async () => new Response("x", { headers: { "content-type": "text/css" } }) } as unknown as Fetcher });
    const r = await get("/assets/app.css", env);
    expect(await r.text()).toBe("x");
    expect(r.headers.get("x-robots-tag")).toBeNull();
  });
});

describe("robots and sitemap", () => {
  it("blocks private areas and points to the sitemap in production", async () => {
    const txt = await (await get("/robots.txt", prodEnv())).text();
    expect(txt).toContain("Disallow: /api/");
    expect(txt).toContain("Disallow: /admin");
    expect(txt).toContain("Disallow: /workbook");
    expect(txt).toContain("Sitemap: https://ads.example.com/sitemap.xml");
  });
  it("blocks everything outside production", async () => {
    expect(await (await get("/robots.txt", testEnv())).text()).toBe("User-agent: *\nDisallow: /\n");
  });
  it("lists only public pages", async () => {
    const r = await get("/sitemap.xml", prodEnv());
    expect(r.headers.get("content-type")).toContain("application/xml");
    const xml = await r.text();
    expect(xml.match(/<loc>/g)).toHaveLength(2);
    expect(xml).toContain("<loc>https://ads.example.com/</loc>");
    expect(xml).toContain("<loc>https://ads.example.com/privacy</loc>");
  });
});
