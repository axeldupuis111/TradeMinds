-- ============================================================
-- Table: economic_events
-- Cache of scheduled high-impact macro-economic announcements
-- (CPI, NFP, FOMC, rate decisions…), refreshed by a daily Vercel
-- cron from a public calendar feed (faireconomy/ForexFactory weekly
-- JSON by default).
--
-- This is SHARED REFERENCE DATA, not per-user: every authenticated
-- user may read it; only the cron (service role) writes it. It powers
-- the news guardrail — telling the trader "don't trade around this
-- hour" — never a live news feed.
-- ============================================================
CREATE TABLE IF NOT EXISTS economic_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UTC instant of the announcement.
  event_time TIMESTAMPTZ NOT NULL,
  -- ISO currency code the event concerns (USD, EUR, GBP, JPY…).
  currency TEXT NOT NULL,
  title TEXT NOT NULL,
  impact TEXT NOT NULL CHECK (impact IN ('high', 'medium', 'low', 'holiday')),
  forecast TEXT,
  previous TEXT,
  actual TEXT,
  source TEXT NOT NULL DEFAULT 'faireconomy',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Same announcement = same (time, currency, title): used for upsert.
  CONSTRAINT economic_events_time_currency_title_key UNIQUE (event_time, currency, title)
);

CREATE INDEX IF NOT EXISTS economic_events_time_idx ON economic_events(event_time);
CREATE INDEX IF NOT EXISTS economic_events_currency_impact_idx ON economic_events(currency, impact);

-- Row Level Security: readable by any authenticated user, writable only
-- by the service role (cron) which bypasses RLS — so no write policy.
ALTER TABLE economic_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read economic events"
  ON economic_events FOR SELECT TO authenticated
  USING (true);

-- Auto-update updated_at on every UPDATE (upsert refresh).
CREATE OR REPLACE FUNCTION update_economic_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS economic_events_updated_at_trigger ON economic_events;
CREATE TRIGGER economic_events_updated_at_trigger
  BEFORE UPDATE ON economic_events
  FOR EACH ROW
  EXECUTE FUNCTION update_economic_events_updated_at();

COMMENT ON TABLE economic_events IS 'Shared cache of scheduled macro announcements for the news guardrail. Read by all authenticated users; written only by the daily cron (service role).';
COMMENT ON COLUMN economic_events.impact IS 'high | medium | low | holiday — only high/medium drive the guardrail.';
