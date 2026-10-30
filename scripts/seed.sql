-- Demo data for the admin pages in local development. Fictional businesses only.
-- npm run db:seed:local

INSERT OR IGNORE INTO users (id, email, email_verified_at, consent_version) VALUES
  ('u_demo1', 'demo1@example.com', datetime('now','-3 days'), 2),
  ('u_demo2', NULL, NULL, 2);

INSERT OR IGNORE INTO workspaces (id, user_id, name, company, website, industry_pack, offer_line, service_city, audience_type, funnel_type, channel, onboarding_step, onboarding_done_at, completed_sections, created_at, updated_at) VALUES
  ('w_demo1', 'u_demo1', 'Bright Spark Electrical', 'Bright Spark Electrical', 'example.com', 'trades', 'Licensed electrician, same week jobs', 'Brisbane', 'b2c', '1step', 'google', 8, datetime('now','-3 days'), '["three-cs","forecasting","ten-principles","customer-avatar"]', datetime('now','-3 days'), datetime('now','-1 hours')),
  ('w_demo2', 'u_demo2', 'Calm Ledger', 'Calm Ledger', NULL, 'professional', 'Bookkeeping for small businesses', 'Melbourne', 'b2b', '2step', 'meta', 5, NULL, '[]', datetime('now','-1 days'), datetime('now','-1 days'));

INSERT OR IGNORE INTO answers (workspace_id, module, field_id, value_json) VALUES
  ('w_demo1', 'customer-avatar', 'av_away_1', '{"value":"Taking a day off work for a no-show","origin":"user"}'),
  ('w_demo1', 'customer-avatar', 'av_away_2', '{"value":"Surprise bills","origin":"suggestion","suggestion_run_id":"r_demo1"}'),
  ('w_demo1', 'customer-avatar', 'av_towards_1', '{"value":"A tradie who turns up on time","origin":"user"}'),
  ('w_demo1', 'customer-avatar', 'av_attempts_1', '{"value":"Used the cheapest quote","origin":"user"}'),
  ('w_demo1', 'forecasting', 'fc_daily_budget', '{"value":40,"origin":"user"}'),
  ('w_demo2', 'customer-avatar', 'av_away_1', '{"value":"Finding out what you owe after it is too late","origin":"user"}');

INSERT OR IGNORE INTO ai_runs (id, workspace_id, user_id, section, field_id, action, model, context_keys_json, input_tokens, output_tokens, cost_usd, latency_ms, output_json, used, rating, created_at) VALUES
  ('r_demo1', 'w_demo1', 'u_demo1', 'customer-avatar', 'av_away_2', 'suggest', 'claude-sonnet-5-5', '["av_away_1"]', 2800, 420, 0.0098, 2100, '{"options":[{"text":"Surprise bills","note":"from your pains","from":"av_away_1"}]}', 1, 1, datetime('now','-2 days')),
  ('r_demo2', 'w_demo1', 'u_demo1', 'messaging', 'msg_headline_1', 'ideas', 'claude-sonnet-5-5', '["av_away_1"]', 3100, 900, 0.0152, 3400, '{"options":[]}', 0, NULL, datetime('now','-1 days')),
  ('r_demo3', 'w_demo2', 'u_demo2', 'messaging', 'msg_headline_1', 'check', 'claude-haiku-5-5', '[]', 1900, 180, 0.0003, 900, '{"results":[]}', 0, -1, datetime('now','-1 days'));

INSERT OR IGNORE INTO research_runs (id, workspace_id, recipe, status, step, result_json, sources_json, ahrefs_units, cost_usd, started_at, finished_at) VALUES
  ('rr_demo1', 'w_demo1', 'search_demand', 'done', 'Done', '{"totalVolume":1450,"terms":[{"keyword":"electrician brisbane","volume":900},{"keyword":"emergency electrician brisbane","volume":550}]}', '[]', 180, 0, datetime('now','-2 days'), datetime('now','-2 days'));

INSERT OR IGNORE INTO events (workspace_id, user_id, type, data_json, created_at) VALUES
  ('w_demo1', 'u_demo1', 'onboarding_completed', '{}', datetime('now','-3 days')),
  ('w_demo1', 'u_demo1', 'section_completed', '{"section":"customer-avatar"}', datetime('now','-1 days')),
  ('w_demo1', 'u_demo1', 'assist_used', '{"field_id":"av_away_2"}', datetime('now','-2 days')),
  ('w_demo2', 'u_demo2', 'onboarding_step', '{"step":5}', datetime('now','-1 days'));

INSERT INTO spend_daily (day, claude_cost_usd, web_searches, ahrefs_units) VALUES (date('now','-1 days'), 0.0253, 0, 180)
  ON CONFLICT(day) DO NOTHING;
