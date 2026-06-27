-- ============================================================
-- Table: macro_analyses
-- One AI-generated daily macro-economic briefing per (date, language).
-- A Vercel cron (/api/macro-analysis/generate) produces ONE analysis per day
-- in French (Sonnet + web search for fresh context), then translates it to the
-- other three languages (Haiku). The same analysis is served to every premium
-- member — this is SHARED PREMIUM CONTENT, not per-user.
--
-- It describes the state of the world economy and the events (scheduled
-- announcements, geopolitics, central-bank moves) that can move markets. It is
-- an informational context briefing, NEVER a buy/sell recommendation.
--
-- RLS is enabled but there is NO read policy: access is premium-gated in the
-- /api/macro-analysis route (service role, bypasses RLS). The cron is the only
-- writer (service role). This prevents free/plus users from reading the table
-- directly through the anon client.
-- ============================================================

CREATE TABLE IF NOT EXISTS macro_analyses (
  -- Calendar day the briefing is for (one per day per language).
  analysis_date DATE NOT NULL,
  lang          TEXT NOT NULL CHECK (lang IN ('fr', 'en', 'de', 'es')),
  -- One-line headline summarising the day.
  headline      TEXT NOT NULL,
  -- Opening paragraph: state of the global economy.
  overview      TEXT NOT NULL,
  -- Key themes: [{ "title": "...", "body": "..." }, ...]
  themes        JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Risks / events to watch: [{ "title": "...", "body": "..." }, ...]
  watchlist     JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- One-line context takeaway (never a recommendation).
  takeaway      TEXT,
  -- Model that produced/translated the row, for auditing.
  model         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (analysis_date, lang)
);

CREATE INDEX IF NOT EXISTS macro_analyses_date_idx ON macro_analyses(analysis_date DESC);

ALTER TABLE macro_analyses ENABLE ROW LEVEL SECURITY;

-- No SELECT policy on purpose: reads go through the premium-gated API route
-- using the service role. The cron is the only writer (service role).

COMMENT ON TABLE macro_analyses IS 'Daily AI macro-economic briefing, one row per (date, language). Shared premium content; written by the daily cron and read only via the premium-gated /api/macro-analysis route (both service role).';
COMMENT ON COLUMN macro_analyses.themes IS 'JSON array of {title, body} — the key macro themes of the day.';
COMMENT ON COLUMN macro_analyses.watchlist IS 'JSON array of {title, body} — events/risks to watch (informational, never a recommendation).';
