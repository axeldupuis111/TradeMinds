-- Add market_type column to prop_challenges
-- 'cfd'     → CFD account (Forex, Gold, Indices via spread-betting / CFD broker)
-- 'futures' → Regulated futures account (CME, CBOT, NYMEX contracts)
-- Default 'cfd' so all existing accounts remain CFD — zero regression.
ALTER TABLE prop_challenges
  ADD COLUMN IF NOT EXISTS market_type TEXT NOT NULL DEFAULT 'cfd';

ALTER TABLE prop_challenges
  DROP CONSTRAINT IF EXISTS prop_challenges_market_type_check;

ALTER TABLE prop_challenges
  ADD CONSTRAINT prop_challenges_market_type_check
  CHECK (market_type IN ('cfd', 'futures'));

COMMENT ON COLUMN prop_challenges.market_type IS 'Market type: ''cfd'' (default) or ''futures''. Drives pip/tick value calculation in the position sizer.';
