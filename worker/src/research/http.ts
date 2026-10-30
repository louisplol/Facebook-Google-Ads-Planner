// One place to swap fetch in tests, so no test ever reaches Ahrefs, Browser Rendering or the web.
let override: typeof fetch | null = null;

export function setResearchFetch(f: typeof fetch | null) {
  override = f;
}

export const rfetch: typeof fetch = (input, init) => (override ?? fetch)(input, init);
