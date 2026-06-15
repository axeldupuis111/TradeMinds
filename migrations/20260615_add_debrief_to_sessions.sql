-- ============================================================
-- sessions.debrief — persists the AI end-of-session debrief.
-- Written by /api/session-debrief after a session ends; the client also
-- caches it in localStorage. JSONB shape:
--   { score, worked, slipped, focus, tradeCount, pnl, ai }
-- ============================================================
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS debrief JSONB;

COMMENT ON COLUMN sessions.debrief IS 'AI end-of-session debrief: { score, worked, slipped, focus, tradeCount, pnl, ai }. NULL until the session is ended and a debrief is generated.';
