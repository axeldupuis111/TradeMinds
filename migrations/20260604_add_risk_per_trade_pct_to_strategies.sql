-- Add risk_per_trade_pct column to strategies
-- Stores the % of account balance the trader is willing to risk per trade (e.g. 1.0 = 1%).
-- Nullable: not all strategies define a fixed risk %.
ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS risk_per_trade_pct NUMERIC;

COMMENT ON COLUMN strategies.risk_per_trade_pct IS '% of account balance risked per trade (e.g. 1.0 = 1%). NULL when not defined.';
