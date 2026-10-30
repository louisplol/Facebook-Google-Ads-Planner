import { OG_IMAGE, PUBLIC_PATHS, pageMeta } from "@pmw/engine";
import { isDev, type Env } from "./env.ts";

// Search engines only ever index the public pages of the production site. Previews and local copies are hidden.
const indexable = (env: Env) => env.ENVIRONMENT === "production";
const brandOf = (env: Env) => env.BRAND_NAME || "Paid Marketing Workbook";
export const siteUrl = (env: Env, req: Request) => (env.APP_URL || new URL(req.url).origin).replace(/\/+$/, "");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function robotsTxt(env: Env, req: Request): string {
  if (!indexable(env)) return "User-agent: *\nDisallow: /\n";
  // Private pages are blocked so crawlers never create visitor sessions or workbooks.
  const blocked = ["/api/", "/admin", "/workbook", "/onboarding", "/plan", "/save", "/settings"];
  return ["User-agent: *", "Allow: /", ...blocked.map((p) => `Disallow: ${p}`), "", `Sitemap: ${siteUrl(env, req)}/sitemap.xml`, ""].join("\n");
}

export function sitemapXml(env: Env, req: Request): string {
  const base = siteUrl(env, req);
  const urls = PUBLIC_PATHS.map((p) => `  <url><loc>${esc(base + p)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Whether a page response should carry noindex, for the X-Robots-Tag header. */
export const noindex = (env: Env, pathname: string) => !indexable(env) || !pageMeta(pathname, "").index;

/** Writes the title, description, canonical link, social preview and structured data into the page head. */
export function renderHead(html: string, env: Env, req: Request): string {
  const url = new URL(req.url);
  const brand = brandOf(env);
  const meta = pageMeta(url.pathname, brand);
  const base = siteUrl(env, req);
  const canonical = base + (url.pathname.replace(/\/+$/, "") || "/");
  const tags = [
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${noindex(env, url.pathname) ? "noindex, nofollow" : "index, follow, max-image-preview:large"}" />`,
  ];
  if (meta.index) {
    tags.push(
      `<link rel="canonical" href="${esc(canonical)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${esc(brand)}" />`,
      `<meta property="og:locale" content="en_AU" />`,
      `<meta property="og:url" content="${esc(canonical)}" />`,
      `<meta property="og:title" content="${esc(meta.title)}" />`,
      `<meta property="og:description" content="${esc(meta.description)}" />`,
      `<meta property="og:image" content="${esc(base + OG_IMAGE.path)}" />`,
      `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
      `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
      `<meta property="og:image:alt" content="${esc(OG_IMAGE.alt)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(meta.title)}" />`,
      `<meta name="twitter:description" content="${esc(meta.description)}" />`,
      `<meta name="twitter:image" content="${esc(base + OG_IMAGE.path)}" />`,
    );
  }
  if (url.pathname === "/") {
    const ld = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: brand,
      url: `${base}/`,
      description: meta.description,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "en-AU",
      isAccessibleForFree: true,
    };
    // Escaping "<" keeps the JSON from closing the script tag early.
    tags.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`);
  }
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/\s*<meta name="(description|robots)"[^>]*>/g, "")
    .replace(/\s*<\/head>/, `\n    ${tags.join("\n    ")}\n  </head>`);
}

/** Serves a page from static assets with its head filled in. Non HTML files pass straight through. */
export async function servePage(env: Env, req: Request): Promise<Response> {
  if (!env.ASSETS) return new Response("Not found", { status: 404 });
  const res = await env.ASSETS.fetch(req);
  const pathname = new URL(req.url).pathname;
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) return res;
  const out = new Response(renderHead(await res.text(), env, req), res);
  out.headers.delete("content-length");
  if (noindex(env, pathname)) out.headers.set("X-Robots-Tag", "noindex, nofollow");
  // Pages carry per visit meta, so browsers and the edge always ask again. Hashed assets stay cached.
  if (!isDev(env)) out.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return out;
}
