export interface Env {
  DB: D1Database;
  UPLOADS?: R2Bucket;
  RESEARCH_WORKFLOW?: Workflow;
  ASSETS?: Fetcher;

  ENVIRONMENT: string;
  BRAND_NAME: string;
  APP_URL?: string;
  VIDEO_URL?: string;
  DEFAULT_CURRENCY?: string;
  DEFAULT_COUNTRY?: string;

  ASSIST_ENABLED?: string;
  RESEARCH_ENABLED?: string;
  AI_MODEL_RESEARCH?: string;
  AI_MODEL_WRITE?: string;
  AI_MODEL_CHECK?: string;
  AI_MONTHLY_BUDGET_USD?: string;
  AHREFS_DAILY_UNIT_CAP?: string;
  ASSIST_DAILY_ANON?: string;
  ASSIST_DAILY_SAVED?: string;
  RESEARCH_DAILY_SAVED?: string;
  CONSENT_VERSION?: string;

  ANTHROPIC_API_KEY?: string;
  AHREFS_API_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_BROWSER_TOKEN?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  SESSION_SECRET?: string;
  ADMIN_EMAILS?: string;
  ADMIN_DEV_TOKEN?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ALERT_EMAIL?: string;
}

export const flag = (v: string | undefined, dflt = false) => (v === undefined || v === "" ? dflt : v === "true" || v === "1");
export const intVar = (v: string | undefined, dflt: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : dflt;
};
export const isDev = (env: Env) => env.ENVIRONMENT === "development" || env.ENVIRONMENT === "test";
