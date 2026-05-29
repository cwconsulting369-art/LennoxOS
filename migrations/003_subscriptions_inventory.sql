-- 003_subscriptions_inventory.sql
-- Master-Inventar aller Subscriptions (aus Email-Scan + MD-Seed + Manual)
-- + Many-to-Many Project-Allocation (Tool-Reselling-Modell: jeder Project der nutzt zahlt FULL price)

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  bigserial PRIMARY KEY,
  vendor              text NOT NULL,           -- vercel, cloudflare, anthropic, hetzner, ...
  product_name        text NOT NULL,           -- "Vercel Pro", "Claude Max", "Hetzner CX22"
  plan                text,                    -- tier/plan label
  amount_cents        integer NOT NULL DEFAULT 0,
  currency            text NOT NULL DEFAULT 'eur',
  interval            text NOT NULL DEFAULT 'month',  -- month / year / usage
  status              text NOT NULL DEFAULT 'active', -- active / cancelled / paused / unknown
  account_source      text,                    -- email-account that pays (cwconsulting369 / carloswrusch97 / cc / manual)
  source              text NOT NULL DEFAULT 'manual', -- manual / email_scan / md_seed
  category            text,                    -- infra / ai / automation / marketing / dev / personal
  vendor_url          text,
  notes               text,
  raw                 jsonb,                   -- email-extraction raw / receipt details
  first_seen_at       timestamptz,
  last_charged_at     timestamptz,
  next_renewal_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor, product_name, plan, amount_cents)
);

CREATE INDEX IF NOT EXISTS idx_subs_vendor   ON subscriptions(vendor);
CREATE INDEX IF NOT EXISTS idx_subs_status   ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subs_category ON subscriptions(category);

-- Many-to-Many: welcher Project nutzt welche Subscription
-- Tool-Reselling-Model: jeder project der eingetragen ist zahlt den FULL subscription-amount
CREATE TABLE IF NOT EXISTS project_subscription_uses (
  id                  bigserial PRIMARY KEY,
  subscription_id     bigint NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  project_slug        text NOT NULL,            -- aevum / gts / utilityhub / ketolabs / thailand / k3ngama / lennoxos / personal
  in_use_since        date,
  in_use_until        date,                     -- null = still in use
  billable            boolean DEFAULT true,    -- if false: Carlos eats the cost (e.g. internal-only)
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, project_slug)
);

CREATE INDEX IF NOT EXISTS idx_psu_project ON project_subscription_uses(project_slug);

-- Email-Scan-Runs (debugging)
CREATE TABLE IF NOT EXISTS email_scan_runs (
  id                  bigserial PRIMARY KEY,
  account             text NOT NULL,
  scanned_at          timestamptz NOT NULL DEFAULT now(),
  range_days          integer,
  messages_scanned    integer DEFAULT 0,
  receipts_extracted  integer DEFAULT 0,
  subs_upserted       integer DEFAULT 0,
  status              text DEFAULT 'running',
  error               text
);
