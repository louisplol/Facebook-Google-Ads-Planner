// Research config. Lists here are app settings, not benchmarks.

/** Directories and marketplaces: start unticked as competitors and are left out of competitor results. */
export const DIRECTORY_DOMAINS = [
  "yelp.com",
  "yelp.com.au",
  "yellowpages.com.au",
  "yellowpages.com",
  "truelocal.com.au",
  "hipages.com.au",
  "airtasker.com",
  "oneflare.com.au",
  "serviceseeking.com.au",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "google.com",
  "google.com.au",
  "wikipedia.org",
  "gumtree.com.au",
  "seek.com.au",
  "indeed.com",
  "au.indeed.com",
  "productreview.com.au",
  "tripadvisor.com.au",
  "tripadvisor.com",
  "hotfrog.com.au",
  "starofservice.com.au",
  "youtube.com",
  "reddit.com",
];

export function isDirectory(domain: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return DIRECTORY_DOMAINS.some((x) => d === x || d.endsWith(`.${x}`));
}

export const BOT_USER_AGENT = "PaidMarketingWorkbookBot/1.0 (+reads public pages to suggest workbook answers)";
export const ROBOTS_UA_TOKEN = "PaidMarketingWorkbookBot";

export const CACHE_DAYS = 30;
export const MAX_SCAN_PAGES = 10;
export const MAX_SEEDS = 15;

/** Paths that tend to describe the business, read first. */
export const PRIORITY_PATHS = ["service", "about", "pricing", "price", "contact", "review", "testimonial", "work", "what-we-do", "faq"];
