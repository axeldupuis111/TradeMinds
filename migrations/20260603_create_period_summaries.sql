-- ============================================================
-- Table: period_summaries
-- Stores AI-generated weekly and monthly trading summaries (Premium).
-- One summary per user / period_type / period_start — upsertable.
-- ============================================================
CREATE TABLE IF NOT EXISTS period_summaries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_type TEXT        NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  period_start DATE       NOT NULL,
  period_end  DATE        NOT NULL,
  language    TEXT        NOT NULL DEFAULT 'fr',
  content     TEXT        NOT NULL,
  stats       JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_type, period_start)
);

-- Index for fast per-user lookups (list + history)
CREATE INDEX IF NOT EXISTS period_summaries_user_id_idx ON period_summaries(user_id);

-- Row Level Security: users can only read and write their own summaries
ALTER TABLE period_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own period summaries"
  ON period_summaries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own period summaries"
  ON period_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own period summaries"
  ON period_summaries
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_period_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS period_summaries_updated_at_trigger ON period_summaries;
CREATE TRIGGER period_summaries_updated_at_trigger
  BEFORE UPDATE ON period_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_period_summaries_updated_at();

-- Documentation
COMMENT ON TABLE period_summaries IS 'AI-generated weekly and monthly trading summaries (Premium feature). One row per user/period_type/period_start — upsertable.';
COMMENT ON COLUMN period_summaries.period_type IS 'weekly or monthly';
COMMENT ON COLUMN period_summaries.period_start IS 'Inclusive start date of the period (Monday for weekly, 1st for monthly)';
COMMENT ON COLUMN period_summaries.period_end IS 'Inclusive end date of the period (Sunday for weekly, last day for monthly)';
COMMENT ON COLUMN period_summaries.content IS 'Raw AI-generated summary text (plain text, no markdown title)';
COMMENT ON COLUMN period_summaries.stats IS 'Aggregated stats snapshot: total_trades, wins, losses, total_pnl, win_rate, best_pair, worst_pair, discipline_avg, etc.';

-- ============================================================
-- profiles: add daily_summary_count + daily_summary_reset
-- Quota counters for the period-summary feature (Premium only).
-- Same type pattern as daily_ai_count / daily_ai_reset.
-- ============================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS daily_summary_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_summary_reset  TEXT;

COMMENT ON COLUMN profiles.daily_summary_count IS 'Number of AI period summaries generated today (resets daily). Used for Premium quota enforcement.';
COMMENT ON COLUMN profiles.daily_summary_reset IS 'ISO date (YYYY-MM-DD) of the last reset for daily_summary_count. NULL means counter has never been used.';
