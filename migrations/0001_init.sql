-- Paid Marketing Workbook schema.
-- v1 tables: users, sessions, workspaces, answers, scenarios, events, magic_links, admin_audit, rate_limits
-- v2 tables: ai_runs, research_runs, research_cache, usage_counters, spend_daily, example_sets, uploads, site_profiles

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  email_verified_at TEXT,
  consent_version INTEGER,
  consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT
);

CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  turnstile_ok_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My business',
  company TEXT,
  website TEXT,
  website_owner_confirmed INTEGER NOT NULL DEFAULT 0,
  no_website INTEGER NOT NULL DEFAULT 0,
  industry_pack TEXT,
  industry_text TEXT,
  offer_line TEXT,
  service_city TEXT,
  country TEXT NOT NULL DEFAULT 'AU',
  currency TEXT NOT NULL DEFAULT 'AUD',
  audience_type TEXT CHECK (audience_type IN ('b2b','b2c','both')),
  sell_mode TEXT,
  goal TEXT,
  current_spend TEXT,
  tracking_status TEXT,
  funnel_type TEXT CHECK (funnel_type IN ('1step','2step','checkout')),
  channel TEXT CHECK (channel IN ('meta','google')),
  software_archetype TEXT,
  onboarding_step INTEGER NOT NULL DEFAULT 0,
  onboarding_done_at TEXT,
  last_section TEXT,
  completed_sections TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX workspaces_user ON workspaces(user_id);

CREATE TABLE answers (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  field_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, field_id)
);
CREATE INDEX answers_module ON answers(module);

CREATE TABLE scenarios (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  overrides_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT,
  user_id TEXT,
  type TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX events_type ON events(type, created_at);
CREATE INDEX events_ws ON events(workspace_id);

CREATE TABLE admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email TEXT NOT NULL,
  route TEXT NOT NULL,
  params_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- v2

CREATE TABLE ai_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT,
  section TEXT,
  field_id TEXT,
  action TEXT NOT NULL,
  model TEXT,
  context_keys_json TEXT NOT NULL DEFAULT '[]',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  output_json TEXT,
  used INTEGER NOT NULL DEFAULT 0,
  rating INTEGER,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ai_runs_ws ON ai_runs(workspace_id);
CREATE INDEX ai_runs_created ON ai_runs(created_at);

CREATE TABLE research_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  recipe TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  step TEXT,
  params_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  sources_json TEXT NOT NULL DEFAULT '[]',
  web_searches INTEGER NOT NULL DEFAULT 0,
  ahrefs_units INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  model TEXT,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);
CREATE INDEX research_runs_ws ON research_runs(workspace_id);

CREATE TABLE research_cache (
  key_hash TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  report TEXT NOT NULL,
  params_json TEXT NOT NULL,
  country TEXT,
  response_json TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE usage_counters (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('assist','research')),
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, kind)
);

CREATE TABLE spend_daily (
  day TEXT PRIMARY KEY,
  claude_cost_usd REAL NOT NULL DEFAULT 0,
  web_searches INTEGER NOT NULL DEFAULT 0,
  ahrefs_units INTEGER NOT NULL DEFAULT 0,
  browser_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE example_sets (
  industry_key TEXT NOT NULL,
  offer_hash TEXT NOT NULL,
  examples_json TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (industry_key, offer_hash)
);

CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ad_screenshot','csv')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE site_profiles (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  domain TEXT,
  status TEXT NOT NULL CHECK (status IN ('scanning','needs_confirm','confirmed','failed','no_website')),
  pages_json TEXT NOT NULL DEFAULT '[]',
  profile_json TEXT NOT NULL DEFAULT '{}',
  tracking_json TEXT NOT NULL DEFAULT '{}',
  ahrefs_json TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  scanned_at TEXT,
  confirmed_at TEXT,
  expires_at TEXT
);
CREATE INDEX site_profiles_domain ON site_profiles(domain);
