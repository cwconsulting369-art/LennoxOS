-- 005_ideas.sql
-- Idea-Factory v2 — konsolidierte Ideen-DB (LennoxOS-Supabase)
-- Löst die 3 zerrissenen Layer ab: Airtable (42 verwaist) + MD-Inbox + sorted/archive.
-- Backend (server.cjs, SERVICE_ROLE) ist einziger Zugriff → RLS-on-no-policy = deny-all für anon.
-- Migration applied: 2026-05-29
--
-- Feld-Mapping aus Airtable "Ideen" (appJDdfkdzsIhuSUc/tblpLr3Tb9AlojdVE):
--   Titel→title, Zusammenfassung→summary, Inhalt→content, AI Notiz→ai_note,
--   Mehrwert→value_add, Status→status, Bewertung→evaluation, Priorität→priority,
--   Hebel→leverage, Kategorie→category, Projekt→project, Inhaltstyp→content_type,
--   Quelle→source, Relevanz→relevance, URL→url, Tags→tags
-- Neu: origin/airtable_id/source_file/dedup_hash/is_duplicate/duplicate_of (Provenance + Dedup)

CREATE TABLE IF NOT EXISTS ideas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  summary       text,                                            -- Zusammenfassung
  content       text,                                            -- Inhalt / Rohtext
  ai_note       text,                                            -- AI Notiz
  value_add     text,                                            -- Mehrwert
  url           text,
  tags          text[] NOT NULL DEFAULT '{}',

  status        text NOT NULL DEFAULT 'neu'
                  CHECK (status IN ('neu','in_arbeit','erledigt','verworfen')),
  evaluation    text CHECK (evaluation IN ('einbauen','on_hold','verwerfen','vorhanden')),  -- Bewertung
  priority      text CHECK (priority IN ('hoch','mittel','niedrig')),
  leverage      text CHECK (leverage IN ('hoch','mittel','niedrig')),                        -- Hebel
  category      text CHECK (category IN ('business','tech','marketing','automatisierung','finanzen','sonstiges')),
  project       text CHECK (project IN ('aevum','utilityhub','lennoxos','ketolabs','gts','none')),
  content_type  text,                                            -- Inhaltstyp: idee/youtube/web/voice/datei/text
  source        text,                                            -- Quelle: telegram_text/voice/youtube/web/drive/md_import
  relevance     integer CHECK (relevance BETWEEN 0 AND 5),

  -- Provenance + Dedup
  origin        text NOT NULL DEFAULT 'tg'
                  CHECK (origin IN ('airtable','tg','md_import','manual')),
  airtable_id   text UNIQUE,                                     -- idempotente Airtable-Migration
  source_file   text,                                            -- MD-Inbox-Pfad falls origin=md_import
  dedup_hash    text,                                            -- normalisierter Titel-Hash (Dedup-Erkennung)
  is_duplicate  boolean NOT NULL DEFAULT false,
  duplicate_of  uuid REFERENCES ideas(id) ON DELETE SET NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ideas_status     ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_project     ON ideas(project);
CREATE INDEX IF NOT EXISTS idx_ideas_category    ON ideas(category);
CREATE INDEX IF NOT EXISTS idx_ideas_origin      ON ideas(origin);
CREATE INDEX IF NOT EXISTS idx_ideas_dedup       ON ideas(dedup_hash);
CREATE INDEX IF NOT EXISTS idx_ideas_created     ON ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_active      ON ideas(status) WHERE is_duplicate = false AND status IN ('neu','in_arbeit');

-- updated_at trigger (nutzt existierende Funktion update_updated_at_column)
DROP TRIGGER IF EXISTS trg_ideas_updated ON ideas;
CREATE TRIGGER trg_ideas_updated
BEFORE UPDATE ON ideas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: enable, keine public-Policy → nur service_role (Backend) kommt ran
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Dashboard-Helper-View: aggregierte Counts (ohne Dubletten)
CREATE OR REPLACE VIEW ideas_stats AS
SELECT
  count(*) FILTER (WHERE NOT is_duplicate)                                   AS total,
  count(*) FILTER (WHERE NOT is_duplicate AND status='neu')                  AS neu,
  count(*) FILTER (WHERE NOT is_duplicate AND status='in_arbeit')            AS in_arbeit,
  count(*) FILTER (WHERE NOT is_duplicate AND status='erledigt')             AS erledigt,
  count(*) FILTER (WHERE NOT is_duplicate AND status='verworfen')            AS verworfen,
  count(*) FILTER (WHERE is_duplicate)                                       AS duplicates,
  count(*) FILTER (WHERE NOT is_duplicate AND priority='hoch' AND status IN ('neu','in_arbeit')) AS offen_hoch
FROM ideas;
