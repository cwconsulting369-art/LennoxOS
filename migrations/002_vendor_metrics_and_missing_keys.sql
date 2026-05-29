-- 002_vendor_metrics_and_missing_keys.sql
-- Adds:
--   * vendor_metrics_daily — generic metrics for non-LLM vendors (bandwidth, deploys, executions...)
--   * missing_api_keys     — tracking-list for endpoints we couldn't reach + how to fix

CREATE TABLE IF NOT EXISTS vendor_metrics_daily (
  day             date NOT NULL,
  vendor          text NOT NULL,            -- vercel / cloudflare / hetzner / gemini / ...
  metric_name     text NOT NULL,            -- bandwidth_gb / deployments / requests / executions / minutes_used / records_count
  scope           text DEFAULT '',          -- project/zone/repo identifier within vendor (or '' for account-wide)
  value           numeric NOT NULL DEFAULT 0,
  unit            text,                     -- gb / count / minutes / usd / requests
  cost_usd        numeric(10,4) DEFAULT 0,
  raw             jsonb,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, vendor, metric_name, scope)
);

CREATE INDEX IF NOT EXISTS idx_vendor_metrics_day ON vendor_metrics_daily(day DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_metrics_vendor ON vendor_metrics_daily(vendor);

CREATE TABLE IF NOT EXISTS missing_api_keys (
  id              bigserial PRIMARY KEY,
  vendor          text NOT NULL,
  needed_key      text NOT NULL,            -- e.g. "ANTHROPIC_ADMIN_KEY"
  needed_scope    text,                     -- e.g. "api.usage.read"
  reason          text,                     -- what we'd unlock by having it
  console_url     text,                     -- where to generate it
  status          text DEFAULT 'pending',   -- pending / resolved / wont_fix
  noted_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  UNIQUE (vendor, needed_key)
);
