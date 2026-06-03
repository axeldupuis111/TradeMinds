-- Add trailing_drawdown flag to prop_challenges
-- When true, the max DD is calculated on peak equity (trailing), not on initial account size.
ALTER TABLE prop_challenges
  ADD COLUMN IF NOT EXISTS trailing_drawdown BOOLEAN NOT NULL DEFAULT false;
