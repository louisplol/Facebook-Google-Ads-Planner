// Page titles, descriptions and indexing rules. The Worker writes these into the HTML head and the
// web app uses the same titles as people move between pages, so search and the browser tab agree.
import { sectionById } from "./content/sections/index.ts";

export interface PageMeta {
  title: string;
  description: string;
  /** Only public marketing pages are indexed. Workbooks are private to each visitor. */
  index: boolean;
}

export const SEO_TAGLINE = "Paid Ads Workbook: Plan Facebook and Google Ads";
export const SEO_DESCRIPTION =
  "Plan, launch and measure Facebook and Google ads step by step. Set your budget, write your ads and landing page, and forecast leads from your own numbers.";
export const OG_IMAGE = { path: "/og.png", width: 1200, height: 630, alt: "Paid ads you can plan, launch and measure. A funnel from click to lead, call and sale." };

/** Paths listed in the sitemap. Everything else is noindex. */
export const PUBLIC_PATHS = ["/", "/privacy"] as const;

const PRIVATE_TITLES: Record<string, string> = {
  "/onboarding": "Get started",
  "/plan": "My Plan",
  "/save": "Save my work",
  "/settings": "Settings",
  "/admin": "Admin",
};

export function pageMeta(pathname: string, brand: string): PageMeta {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { title: `${SEO_TAGLINE} | ${brand}`, description: SEO_DESCRIPTION, index: true };
  if (path === "/privacy") return { title: `Privacy | ${brand}`, description: `What ${brand} keeps, who it shares it with and how to delete your work.`, index: true };
  const section = /^\/workbook\/([^/]+)$/.exec(path);
  const name = section ? sectionById(section[1]!)?.title : (PRIVATE_TITLES[path] ?? (path.startsWith("/admin") ? "Admin" : undefined));
  return { title: name ? `${name} | ${brand}` : brand, description: SEO_DESCRIPTION, index: false };
}
