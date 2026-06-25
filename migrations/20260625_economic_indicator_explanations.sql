-- ============================================================
-- economic_indicator_explanations
-- Global cache of AI-generated explanations for macro indicators that aren't
-- in the curated static glossary (lib/economic-glossary.ts). Keyed by the
-- canonical indicator id + language so a given indicator is generated ONCE
-- and then served to every user for free.
--
-- Not per-user: the explanation describes what the indicator IS, never a
-- user-specific or forecast value. Readable by any authenticated user;
-- written only by the /api/economic-calendar/explain route (service role,
-- bypasses RLS), so there is no write policy.
-- ============================================================

CREATE TABLE IF NOT EXISTS economic_indicator_explanations (
  indicator_key  TEXT NOT NULL,
  lang           TEXT NOT NULL CHECK (lang IN ('fr', 'en', 'de', 'es')),
  what_it_is     TEXT NOT NULL,
  why_it_moves   TEXT NOT NULL,
  beginner_note  TEXT NOT NULL,
  source_title   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (indicator_key, lang)
);

ALTER TABLE economic_indicator_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read indicator explanations"
  ON economic_indicator_explanations FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE economic_indicator_explanations IS 'Global AI-generated fallback explanations for calendar indicators not in the static glossary. One row per (indicator, language); written only by the explain route (service role).';
