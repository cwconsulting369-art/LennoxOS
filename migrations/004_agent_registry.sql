-- 004_agent_registry.sql
-- Agent-Registry: zentrale DB für alle Lennox-Stack Agents
-- Phase 1: Read-only Visibility-Layer (kein Runner). Phase 2: Runner + n8n-Integration.
-- Migration applied: 2026-05-25
--
-- 4 Tabellen:
--   registry_agents          → 1 Row pro Agent (pm2-Service, Workflow, Customer-Bot)
--   registry_agent_runs      → 1 Row pro Run (telemetry, cost, tokens)
--   registry_agent_memory    → Memory-Pointer (File-Paths, DB-Refs, env-Vars)
--   registry_agent_relations → Tree-Structure (parent/child) + cross-refs
--
-- Naming: registry_* prefix vermeidet Konflikt mit existing 'agents' route die zu Paperclip pollt.

-- ───────────────────────────────────────────────────────────────
-- 1) registry_agents — Master-Tabelle
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_agents (
  id              text PRIMARY KEY,                            -- slug: 'thailandre-bot', 'helpbot', etc.
  name            text NOT NULL,                               -- Display name
  role            text NOT NULL,                               -- 'customer-bot'|'helpbot'|'background-worker'|'workflow'|'cron'|'orchestrator'|'api-route'
  parent_id       text REFERENCES registry_agents(id) ON DELETE SET NULL,
  description     text,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','error','archived','planned')),

  -- Capability
  model           text,                                        -- 'claude-sonnet-4-5'|'claude-haiku-4-5'|'claude-opus-4-7'|null
  memory_path     text,                                        -- canonical path to memory dir/file
  system_prompt_path text,                                     -- where system prompt lives
  skills          jsonb NOT NULL DEFAULT '[]'::jsonb,          -- ["whisper","jina-scrape","airtable","tg-send",...]
  guardrails      jsonb NOT NULL DEFAULT '{}'::jsonb,          -- {max_msgs_per_session, max_chars, ...}

  -- Runtime
  runtime         text NOT NULL CHECK (runtime IN ('pm2','cron','n8n','systemd','on-demand','manual','api-route')),
  runtime_ref     text,                                        -- pm2-name OR cron-expr OR n8n-workflow-id
  trigger_type    text CHECK (trigger_type IN ('webhook','schedule','event','tg-message','manual','api')),
  trigger_config  jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Categorization
  project         text,                                        -- 'aevum'|'lennoxos'|'utilityhub'|'gts'|'ketolabs'|'thailand'|'personal'|'global'
  account_slug    text,                                        -- for customer-specific (Patrick, Miguel, Tommy)
  visible         boolean NOT NULL DEFAULT true,

  -- Telemetry (aggregate; updated by sync-job or run-handler)
  last_run_at     timestamptz,
  last_status     text CHECK (last_status IN ('success','error','running','timeout',NULL)),
  total_runs_30d  integer NOT NULL DEFAULT 0,
  total_cost_eur_30d numeric(10,4) NOT NULL DEFAULT 0,
  budget_cap_eur_monthly numeric(10,2),                        -- null = no cap (yet)

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_agents_project    ON registry_agents(project);
CREATE INDEX IF NOT EXISTS idx_registry_agents_status     ON registry_agents(status);
CREATE INDEX IF NOT EXISTS idx_registry_agents_parent     ON registry_agents(parent_id);
CREATE INDEX IF NOT EXISTS idx_registry_agents_runtime    ON registry_agents(runtime);
CREATE INDEX IF NOT EXISTS idx_registry_agents_account    ON registry_agents(account_slug);

-- ───────────────────────────────────────────────────────────────
-- 2) registry_agent_runs — Run-Log (telemetry)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_agent_runs (
  id              bigserial PRIMARY KEY,
  agent_id        text NOT NULL REFERENCES registry_agents(id) ON DELETE CASCADE,
  trigger_source  text,                                        -- 'cron'|'webhook:/idea-processor'|'tg:msg'|'manual'
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  duration_ms     integer,                                     -- finished - started
  status          text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error','timeout','cancelled')),

  input_summary   text,                                        -- short description ("user msg", "scheduled run")
  output_summary  text,                                        -- short result description
  error_message   text,                                        -- if status=error

  -- Token telemetry
  model           text,
  input_tokens          integer NOT NULL DEFAULT 0,
  output_tokens         integer NOT NULL DEFAULT 0,
  cache_read_tokens     integer NOT NULL DEFAULT 0,
  cache_write_tokens    integer NOT NULL DEFAULT 0,
  cost_eur        numeric(10,6) NOT NULL DEFAULT 0,

  context         jsonb,                                       -- arbitrary structured
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_runs_agent    ON registry_agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_registry_runs_started  ON registry_agent_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_registry_runs_status   ON registry_agent_runs(status);

-- ───────────────────────────────────────────────────────────────
-- 3) registry_agent_memory — Memory-Pointer
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_agent_memory (
  id              bigserial PRIMARY KEY,
  agent_id        text NOT NULL REFERENCES registry_agents(id) ON DELETE CASCADE,
  memory_type     text NOT NULL CHECK (memory_type IN ('system_prompt','persona','instruction','history','knowledge','env')),
  storage_kind    text NOT NULL CHECK (storage_kind IN ('file','db','env','inline')),
  storage_ref     text NOT NULL,                               -- file-path | table:column:filter | env-var | inline-text
  description     text,
  bytes           integer,                                     -- size estimate
  is_cached       boolean NOT NULL DEFAULT false,              -- ephemeral-cache enabled
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registry_memory_agent ON registry_agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_registry_memory_type  ON registry_agent_memory(memory_type);

-- ───────────────────────────────────────────────────────────────
-- 4) registry_agent_relations — Tree/Graph (parent_id ist Default-Tree, hier auch cross-refs)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registry_agent_relations (
  id              bigserial PRIMARY KEY,
  from_agent_id   text NOT NULL REFERENCES registry_agents(id) ON DELETE CASCADE,
  to_agent_id     text NOT NULL REFERENCES registry_agents(id) ON DELETE CASCADE,
  relation_type   text NOT NULL CHECK (relation_type IN ('triggers','reads_from','writes_to','delegates_to','part_of')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_agent_id, to_agent_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_registry_rel_from ON registry_agent_relations(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_registry_rel_to   ON registry_agent_relations(to_agent_id);

-- ───────────────────────────────────────────────────────────────
-- updated_at trigger (idempotent)
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION registry_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registry_agents_updated ON registry_agents;
CREATE TRIGGER trg_registry_agents_updated
BEFORE UPDATE ON registry_agents
FOR EACH ROW EXECUTE FUNCTION registry_set_updated_at();

DROP TRIGGER IF EXISTS trg_registry_memory_updated ON registry_agent_memory;
CREATE TRIGGER trg_registry_memory_updated
BEFORE UPDATE ON registry_agent_memory
FOR EACH ROW EXECUTE FUNCTION registry_set_updated_at();

-- ───────────────────────────────────────────────────────────────
-- View: agent-tree with aggregated KPIs (read-side helper)
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW registry_agents_kpi AS
SELECT
  a.id, a.name, a.role, a.parent_id, a.status, a.model, a.runtime, a.project, a.account_slug, a.visible,
  a.last_run_at, a.last_status, a.total_runs_30d, a.total_cost_eur_30d, a.budget_cap_eur_monthly,
  (SELECT count(*) FROM registry_agents c WHERE c.parent_id = a.id) AS child_count,
  CASE
    WHEN a.budget_cap_eur_monthly IS NULL THEN NULL
    WHEN a.total_cost_eur_30d >= a.budget_cap_eur_monthly THEN 100
    ELSE ROUND((a.total_cost_eur_30d / a.budget_cap_eur_monthly) * 100, 1)
  END AS budget_usage_pct
FROM registry_agents a;
