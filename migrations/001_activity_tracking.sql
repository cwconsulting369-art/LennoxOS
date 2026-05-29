-- Activity-Tracking-Schema (2026-05-24)
-- Tracks Claude-Code Sessions (lokal), Vendor-API Usage, Stripe-Subscriptions+Payments

-- ============================================================
-- 1. Claude-Code Sessions + Messages (parsed from ~/.claude/projects/*.jsonl)
-- ============================================================

CREATE TABLE IF NOT EXISTS claude_sessions (
  session_id        text PRIMARY KEY,
  project_path      text NOT NULL,            -- decoded from folder-name
  project_slug      text,                     -- normalized (aevum/gts/uh/...)
  file_path         text NOT NULL,            -- abs path to .jsonl
  first_seen_at     timestamptz NOT NULL,
  last_seen_at      timestamptz NOT NULL,
  message_count     integer NOT NULL DEFAULT 0,
  total_input_tokens  bigint NOT NULL DEFAULT 0,
  total_output_tokens bigint NOT NULL DEFAULT 0,
  total_cache_creation_tokens bigint NOT NULL DEFAULT 0,
  total_cache_read_tokens     bigint NOT NULL DEFAULT 0,
  total_tool_calls  integer NOT NULL DEFAULT 0,
  models_used       jsonb DEFAULT '[]'::jsonb,
  file_size_bytes   bigint,
  file_mtime        timestamptz,
  imported_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claude_sessions_last_seen ON claude_sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_claude_sessions_project ON claude_sessions(project_slug);

CREATE TABLE IF NOT EXISTS claude_messages (
  uuid              text PRIMARY KEY,
  session_id        text NOT NULL REFERENCES claude_sessions(session_id) ON DELETE CASCADE,
  parent_uuid       text,
  role              text,                     -- user / assistant / system
  model             text,
  timestamp         timestamptz,
  input_tokens      integer DEFAULT 0,
  output_tokens     integer DEFAULT 0,
  cache_creation_tokens integer DEFAULT 0,
  cache_read_tokens     integer DEFAULT 0,
  tool_use_count    integer DEFAULT 0,
  tool_names        jsonb DEFAULT '[]'::jsonb,
  stop_reason       text
);

CREATE INDEX IF NOT EXISTS idx_claude_messages_session ON claude_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_claude_messages_timestamp ON claude_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_claude_messages_model ON claude_messages(model);

-- Daily aggregate for fast charts
CREATE TABLE IF NOT EXISTS claude_usage_daily (
  day               date NOT NULL,
  model             text NOT NULL,
  project_slug      text,
  message_count     integer NOT NULL DEFAULT 0,
  input_tokens      bigint NOT NULL DEFAULT 0,
  output_tokens     bigint NOT NULL DEFAULT 0,
  cache_creation_tokens bigint NOT NULL DEFAULT 0,
  cache_read_tokens     bigint NOT NULL DEFAULT 0,
  tool_calls        integer NOT NULL DEFAULT 0,
  effective_cost_usd numeric(10,4) DEFAULT 0,  -- computed via API-rates
  PRIMARY KEY (day, model, project_slug)
);

-- ============================================================
-- 2. Vendor-API Usage (OpenRouter, OpenAI, Anthropic-API)
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_usage_daily (
  day               date NOT NULL,
  vendor            text NOT NULL,            -- openrouter / openai / anthropic_api
  model             text NOT NULL,
  request_count     integer NOT NULL DEFAULT 0,
  input_tokens      bigint NOT NULL DEFAULT 0,
  output_tokens     bigint NOT NULL DEFAULT 0,
  cost_usd          numeric(10,4) NOT NULL DEFAULT 0,
  raw               jsonb,                    -- original API response slice
  synced_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, vendor, model)
);

CREATE INDEX IF NOT EXISTS idx_vendor_usage_day ON vendor_usage_daily(day DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_usage_vendor ON vendor_usage_daily(vendor);

-- ============================================================
-- 3. Stripe Subscriptions + Payments (Carlos's eigene Abos)
-- ============================================================

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  stripe_id         text PRIMARY KEY,         -- sub_xxx
  customer_id       text,                     -- cus_xxx
  product_name      text,
  price_nickname    text,
  amount_cents      integer NOT NULL,
  currency          text NOT NULL DEFAULT 'eur',
  interval          text,                     -- month / year
  status            text,                     -- active / canceled / past_due
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  raw               jsonb,
  synced_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_payments (
  stripe_id         text PRIMARY KEY,         -- ch_xxx or pi_xxx
  amount_cents      integer NOT NULL,
  currency          text NOT NULL DEFAULT 'eur',
  status            text,                     -- succeeded / failed / refunded
  description       text,
  created_at        timestamptz NOT NULL,
  subscription_id   text,                     -- nullable, links to stripe_subscriptions
  raw               jsonb,
  synced_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payments_created ON stripe_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_subs_status ON stripe_subscriptions(status);

-- ============================================================
-- 4. Activity-Sync-Runs (for debugging + cron-status)
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_sync_runs (
  id                bigserial PRIMARY KEY,
  source            text NOT NULL,            -- claude-jsonl / openrouter / openai / anthropic / stripe
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  status            text NOT NULL DEFAULT 'running',  -- running / ok / error
  rows_processed    integer DEFAULT 0,
  error             text
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_source_started ON activity_sync_runs(source, started_at DESC);
