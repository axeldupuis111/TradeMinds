-- ============================================================
-- Table: streak_freezes
-- "Gel de série" / streak freeze — a Duolingo-style grace token.
-- Each row marks one trading DAY the user chose to protect: the
-- discipline-streak computation treats a frozen day as clean even
-- if it contained a revenge/FOMO trade, so an occasional slip does
-- not reset the whole streak.
--
-- Quota is enforced at the application layer (N freezes per calendar
-- month); the table only records the days actually frozen.
-- ============================================================
CREATE TABLE IF NOT EXISTS streak_freezes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- ISO trading day being protected (YYYY-MM-DD, trader-local).
  day DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A day can only be frozen once per user.
  CONSTRAINT streak_freezes_user_day_key UNIQUE (user_id, day)
);

CREATE INDEX IF NOT EXISTS streak_freezes_user_id_idx ON streak_freezes(user_id);

-- Row Level Security: users only ever see/manage their own freezes.
ALTER TABLE streak_freezes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own streak freezes"
  ON streak_freezes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own streak freezes"
  ON streak_freezes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own streak freezes"
  ON streak_freezes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE streak_freezes IS 'Streak-freeze grace tokens: days the user protected so a slip does not reset the discipline streak. Quota enforced in app.';
COMMENT ON COLUMN streak_freezes.day IS 'Trading day protected (trader-local YYYY-MM-DD). Treated as clean by the streak computation.';
