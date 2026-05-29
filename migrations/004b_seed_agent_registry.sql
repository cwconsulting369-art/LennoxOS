-- 004b_seed_agent_registry.sql
-- Seed bestehende Lennox-Stack-Agents in Registry
-- Phase 1: Read-only Snapshot. Updates via UI/API später.
-- Re-runnable: ON CONFLICT DO UPDATE.

-- ───────────────────────────────────────────────────────────────
-- Orchestrators (parent agents)
-- ───────────────────────────────────────────────────────────────
INSERT INTO registry_agents (id, name, role, description, status, runtime, runtime_ref, project, visible)
VALUES
  ('lennox-os', 'LennoxOS Dashboard Server', 'orchestrator', 'Master Dashboard, Routes alle KPIs/Agents/Pipeline. Port 4000.', 'active', 'pm2', 'lennox-os', 'lennoxos', true),
  ('aevum-api', 'AEVUM API', 'orchestrator', 'REST API für AEVUM-Customer-Portal + Helpbot + Project-Agents. Port 3210.', 'active', 'pm2', 'aevum-api', 'aevum', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, role = EXCLUDED.role, description = EXCLUDED.description,
  status = EXCLUDED.status, runtime = EXCLUDED.runtime, runtime_ref = EXCLUDED.runtime_ref,
  project = EXCLUDED.project, visible = EXCLUDED.visible;

-- ───────────────────────────────────────────────────────────────
-- AEVUM-API Sub-Agents (api-route level)
-- ───────────────────────────────────────────────────────────────
INSERT INTO registry_agents (
  id, name, role, parent_id, description, status, model, system_prompt_path, skills, guardrails,
  runtime, runtime_ref, trigger_type, project, visible
) VALUES
  ('aevum-helpbot', 'AEVUM Helpbot (Public Shop)',
   'helpbot', 'aevum-api',
   'Public Shop-Vorqualifizierung. 3-Pfad-Routing (Blueprint/Audit/SaaS). Cached system prompt.',
   'active', 'claude-sonnet-4-5-20250929',
   'services/aevum-api/routes/helpbot.js#SYSTEM_PROMPT',
   '["sse-stream","3-path-routing","dsgvo-consent","rate-limit","prompt-injection-guard"]'::jsonb,
   '{"max_messages_per_session":50,"max_chars_per_message":2000,"max_output_tokens":800,"session_ttl_days":7}'::jsonb,
   'api-route', '/api/helpbot/chat', 'webhook', 'aevum', true),

  ('aevum-project-agent', 'AEVUM Project-Agent (Vollkunden)',
   'customer-bot', 'aevum-api',
   'Vollkunden-Agent per Project. Lennox-style File-Memory, channel-aware (portal/tg/terminal/api). Cached system prompt.',
   'active', 'claude-sonnet-4-5-20250929',
   'services/aevum-api/routes/project-agent.js#buildSystemPrompt',
   '["file-memory","multi-channel","memory-extraction","skill-loading"]'::jsonb,
   '{"max_messages_per_session":100,"max_chars_per_message":4000,"max_output_tokens":1500}'::jsonb,
   'api-route', '/api/me/projects/:slug/agent/chat', 'webhook', 'aevum', true),

  ('aevum-auto-plan', 'AEVUM Auto-Plan Engine',
   'background-worker', 'aevum-api',
   'Generiert Pitch-Reports + Auto-Plan-PDFs aus Audit-Antworten. Single Claude call mit structured-output.',
   'active', 'claude-sonnet-4-5-20250929',
   'services/aevum-api/lib/auto-plan.js#llmAnalyze',
   '["structured-json","blueprint-mapping","tier-mapping","pdf-render","tg-notify"]'::jsonb,
   '{}'::jsonb,
   'api-route', '/api/audits/:id/auto-plan', 'manual', 'aevum', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, role = EXCLUDED.role, parent_id = EXCLUDED.parent_id,
  description = EXCLUDED.description, status = EXCLUDED.status, model = EXCLUDED.model,
  system_prompt_path = EXCLUDED.system_prompt_path, skills = EXCLUDED.skills,
  guardrails = EXCLUDED.guardrails, runtime = EXCLUDED.runtime,
  runtime_ref = EXCLUDED.runtime_ref, trigger_type = EXCLUDED.trigger_type;

-- ───────────────────────────────────────────────────────────────
-- pm2 Customer-Bots (1 pro Vollkunde, isoliert)
-- ───────────────────────────────────────────────────────────────
INSERT INTO registry_agents (
  id, name, role, description, status, model, system_prompt_path, skills, guardrails,
  runtime, runtime_ref, trigger_type, project, account_slug, visible
) VALUES
  ('thailandre-bot', 'Patrick Roth Concierge (Thailand)',
   'customer-bot',
   'Patrick''s persönlicher Thailand-RE-Concierge. 8-Prinzipien-Persona. DB-Context-Injection bei jedem Turn.',
   'active', 'anthropic/claude-sonnet-4-5',
   'services/thailandre-bot/index.js#THAILANDRE_SYSTEM_PROMPT',
   '["openrouter","ctx-injection-db","tg-bot","cached-system-prompt"]'::jsonb,
   '{"max_chat_history":14,"ttl_minutes":90,"whitelist":["carlos","patrick"]}'::jsonb,
   'pm2', 'thailandre-bot', 'tg-message', 'aevum', 'patrick-roth', true),

  ('utilityhub-bot', 'UtilityHub Concierge (Miguel)',
   'customer-bot',
   'Miguel''s persönlicher UH-Concierge. DSGVO-Themen, Customer-Onboarding, Portal-Status.',
   'active', 'anthropic/claude-sonnet-4-5',
   'services/utilityhub-bot/index.js#UTILITYHUB_SYSTEM_PROMPT',
   '["openrouter","tg-bot","cached-system-prompt"]'::jsonb,
   '{}'::jsonb,
   'pm2', 'utilityhub-bot', 'tg-message', 'utilityhub', 'utilityhub-hc', true),

  ('aevum-bot-carlos', 'AEVUM-Bot Carlos (Demo)',
   'customer-bot',
   'Carlos''s eigener Customer-Bot — Reply-Keyboard + Section-Data-Flow. Test-Bot für AEVUM-Customer-Pattern.',
   'active', NULL,
   NULL,
   '["reply-keyboard","section-data","magic-link"]'::jsonb,
   '{}'::jsonb,
   'pm2', 'aevum-bot-carlos', 'tg-message', 'aevum', 'carlos-wrusch', true),

  ('aevum-bot-ketolabs', 'AEVUM-Bot Tommy (Ketolabs)',
   'customer-bot',
   'Tommy''s Customer-Bot. Reply-Keyboard + Section-Data-Flow.',
   'active', NULL,
   NULL,
   '["reply-keyboard","section-data","magic-link"]'::jsonb,
   '{}'::jsonb,
   'pm2', 'aevum-bot-ketolabs', 'tg-message', 'ketolabs', 'tommy-ketolabs', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, role = EXCLUDED.role, description = EXCLUDED.description,
  status = EXCLUDED.status, model = EXCLUDED.model,
  system_prompt_path = EXCLUDED.system_prompt_path, skills = EXCLUDED.skills,
  guardrails = EXCLUDED.guardrails, account_slug = EXCLUDED.account_slug;

-- ───────────────────────────────────────────────────────────────
-- Lennox Personal Bots (Carlos's own tools)
-- ───────────────────────────────────────────────────────────────
INSERT INTO registry_agents (
  id, name, role, parent_id, description, status, model, system_prompt_path, skills, guardrails,
  runtime, runtime_ref, trigger_type, project, visible
) VALUES
  ('lennox-tg-bot', 'Lennox TG Bot (Carlos Chat)',
   'orchestrator', 'lennox-os',
   'Carlos''s persönlicher TG-Chat-Bot. Mode-Toggle work/privat. Whisper-Voice. Memory-aware via CLAUDE.md+memory/.',
   'active', 'anthropic/claude-sonnet-4-5',
   'services/lennox-tg-bot/index.js#buildSystemPrompt',
   '["whisper","tg-bot","mode-toggle","memory-loader","cached-system-prompt"]'::jsonb,
   '{"history_max":14,"history_ttl_hours":3,"whitelist_chat_id":"6436074677"}'::jsonb,
   'pm2', 'lennox-tg-bot', 'tg-message', 'lennoxos', true),

  ('kev-bot', 'K3NGAMA Sparring (Kevin Uhl)',
   'customer-bot', NULL,
   'Kevin Uhl''s GTS-Augsburg Sparring-Bot. Workspace-Snapshot-Context.',
   'active', 'anthropic/claude-sonnet-4-5',
   'services/kev-bot/index.js#loadK3ngamaPersona',
   '["tg-bot","workspace-context","cached-system-prompt"]'::jsonb,
   '{"max_tokens":600}'::jsonb,
   'pm2', 'kev-bot', 'tg-message', 'gts', true),

  ('idea-factory-bot', 'Idea Factory Bot',
   'workflow', 'lennox-os',
   'Empfängt Ideas via TG, forwarded an idea-processor (jetzt offline). Soll auf neuen lokalen pm2-Endpoint umgestellt werden.',
   'active', 'anthropic/claude-haiku-4-5',
   NULL,
   '["tg-bot","webhook-forward"]'::jsonb,
   '{}'::jsonb,
   'pm2', 'idea-factory-bot', 'tg-message', 'personal', true),

  ('agent-core', 'Agent-Core (Python)',
   'orchestrator', NULL,
   'Python TG-Bot mit VPS-Tools (read/write/exec/pm2/git). Legacy, parallel zu Lennox-TG.',
   'active', NULL,
   NULL,
   '["vps-tools","python","tg-bot"]'::jsonb,
   '{}'::jsonb,
   'pm2', 'agent-core', 'tg-message', 'lennoxos', true),

  ('weekly-insight', 'Weekly Insight Generator',
   'cron', 'lennox-os',
   'Wöchentlicher Personal-Insight-Generator. Cron-based.',
   'active', NULL,
   NULL,
   '["openrouter","scheduled-output"]'::jsonb,
   '{}'::jsonb,
   'pm2', 'weekly-insight', 'schedule', 'personal', true),

  ('gts-aurus-bot', 'GTS Aurus Bot',
   'workflow', NULL,
   'GTS GoldTraderSociety Signal-Bot. Onboarding + Stripe.',
   'active', NULL,
   NULL,
   '["tg-bot","stripe","onboarding"]'::jsonb,
   '{}'::jsonb,
   'pm2', 'gts-aurus-bot', 'tg-message', 'gts', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, role = EXCLUDED.role, parent_id = EXCLUDED.parent_id,
  description = EXCLUDED.description, status = EXCLUDED.status, model = EXCLUDED.model,
  system_prompt_path = EXCLUDED.system_prompt_path, skills = EXCLUDED.skills,
  guardrails = EXCLUDED.guardrails;

-- ───────────────────────────────────────────────────────────────
-- n8n Workflows (cloud, currently broken — mark error + migration target)
-- ───────────────────────────────────────────────────────────────
INSERT INTO registry_agents (
  id, name, role, description, status, model, runtime, runtime_ref, trigger_type, project, account_slug, visible, last_status
) VALUES
  ('n8n-betterfly-daily', 'Betterfly Daily Inspiration',
   'workflow',
   'Daily 06:00 Notion→Haiku→TG. Cloud-Workflow LukN7vsRAEnJ9AnV. PLANNED MIGRATION to pm2-cron.',
   'error', 'anthropic/claude-haiku-4-5',
   'n8n', 'LukN7vsRAEnJ9AnV', 'schedule', 'personal', NULL, true, 'error'),

  ('n8n-invoice-tracker', 'LennoxOS Invoice Email Tracker',
   'workflow',
   'Gmail-poll 15min → Haiku classify → Supabase lennox_expenses → TG. Cloud-Workflow PfmMXAf6zSpeJgEZ. PLANNED MIGRATION to pm2-cron.',
   'error', 'anthropic/claude-haiku-4-5',
   'n8n', 'PfmMXAf6zSpeJgEZ', 'schedule', 'lennoxos', NULL, true, 'error'),

  ('n8n-idea-factory-v2', 'Idea Factory v2 (Unified)',
   'workflow',
   'TG-Trigger, Voice+URL+Text routing, Whisper, Jina, Claude, Airtable. Cloud-Workflow O0NXlbVSlBuW0gYc. SECURITY: hardcoded keys exposed. PLANNED MIGRATION to pm2-service.',
   'error', 'anthropic/claude-haiku-4-5',
   'n8n', 'O0NXlbVSlBuW0gYc', 'tg-message', 'personal', NULL, true, 'error'),

  ('n8n-idea-daily-summary', 'Idea Factory Daily Summary 18:00',
   'workflow',
   'Daily 18:00 Airtable→Haiku-Briefing→TG. Cloud-Workflow 68DfQeEX25D3A2w6. PLANNED MIGRATION to pm2-cron.',
   'error', 'anthropic/claude-haiku-4-5',
   'n8n', '68DfQeEX25D3A2w6', 'schedule', 'personal', NULL, true, 'error'),

  ('n8n-idea-processor', 'Idea Factory Processor (Webhook)',
   'workflow',
   'POST /webhook/idea-processor → Haiku classify → Airtable → TG reply. Cloud-Workflow mrBaTbIXRk3zLq1W. PLANNED MIGRATION to express-route in idea-factory-bot.',
   'error', 'anthropic/claude-haiku-4-5',
   'n8n', 'mrBaTbIXRk3zLq1W', 'webhook', 'personal', NULL, true, 'error'),

  ('n8n-patrick-linkedin', 'Patrick LinkedIn Lead-Funnel',
   'workflow',
   'Inaktiv seit Erstellung 2026-05-24. Cloud-Workflow FBjvNXme5MwaERqv. Carlos muss UI-Export ziehen.',
   'planned', NULL,
   'n8n', 'FBjvNXme5MwaERqv', 'manual', 'aevum', 'patrick-roth', true, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status,
  last_status = EXCLUDED.last_status;

-- ───────────────────────────────────────────────────────────────
-- Memory-Pointer (system prompts + persona files)
-- ───────────────────────────────────────────────────────────────
INSERT INTO registry_agent_memory (agent_id, memory_type, storage_kind, storage_ref, description, is_cached)
VALUES
  ('aevum-helpbot', 'system_prompt', 'inline', 'services/aevum-api/routes/helpbot.js:59', 'SYSTEM_PROMPT const (~2100 tokens)', true),
  ('aevum-project-agent', 'system_prompt', 'inline', 'services/aevum-api/routes/project-agent.js:154', 'buildSystemPrompt() function', true),
  ('aevum-project-agent', 'history', 'file', 'aevum-api/customers/<slug>/memory/', 'Lennox-style file memory per customer', false),
  ('lennox-tg-bot', 'persona', 'file', '~/.claude/CLAUDE.md', 'Lennox identity bootstrap (18KB)', true),
  ('lennox-tg-bot', 'persona', 'file', '~/.claude/soul.md', 'Soul (4KB)', true),
  ('lennox-tg-bot', 'history', 'file', '~/.claude/projects/-home-carlos/memory/MEMORY.md', 'work memory pool (9.7KB after compaction)', true),
  ('lennox-tg-bot', 'history', 'file', '~/.claude/projects/-home-carlos/memory-private/MEMORY.md', 'privat memory pool', true),
  ('thailandre-bot', 'system_prompt', 'inline', 'services/thailandre-bot/index.js:221', 'THAILANDRE_SYSTEM_PROMPT (~4500 tokens, 8 principles)', true),
  ('utilityhub-bot', 'system_prompt', 'inline', 'services/utilityhub-bot/index.js:143', 'UTILITYHUB_SYSTEM_PROMPT (~3075 tokens)', true),
  ('kev-bot', 'persona', 'file', 'services/kev-bot/persona.md (or inline)', 'K3NGAMA persona (~2735 tokens)', true),
  ('aevum-helpbot', 'knowledge', 'db', 'helpbot_conversations (Supabase AEVUM)', '30d retention, /24-IP-anonymized', false),
  ('aevum-project-agent', 'env', 'env', 'ANTHROPIC_API_KEY', 'Direct Anthropic API for streaming', false)
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────
-- Relations: triggers + delegates
-- ───────────────────────────────────────────────────────────────
INSERT INTO registry_agent_relations (from_agent_id, to_agent_id, relation_type, notes)
VALUES
  ('idea-factory-bot', 'n8n-idea-processor', 'triggers', 'TG-Msg → Webhook POST /idea-processor (currently broken)'),
  ('n8n-idea-processor', 'n8n-idea-factory-v2', 'delegates_to', 'Beide nutzen gleiches Airtable-Schema'),
  ('n8n-idea-daily-summary', 'n8n-idea-processor', 'reads_from', 'Liest Airtable-Records die n8n-idea-processor angelegt hat'),
  ('aevum-helpbot', 'aevum-api', 'part_of', 'Sub-Agent von aevum-api'),
  ('aevum-project-agent', 'aevum-api', 'part_of', 'Sub-Agent von aevum-api'),
  ('aevum-auto-plan', 'aevum-api', 'part_of', 'Sub-Agent von aevum-api'),
  ('lennox-tg-bot', 'lennox-os', 'part_of', 'Sub-Agent von lennox-os Dashboard'),
  ('idea-factory-bot', 'lennox-os', 'part_of', 'Sub-Agent von lennox-os Dashboard'),
  ('weekly-insight', 'lennox-os', 'part_of', 'Sub-Agent von lennox-os Dashboard')
ON CONFLICT (from_agent_id, to_agent_id, relation_type) DO NOTHING;
