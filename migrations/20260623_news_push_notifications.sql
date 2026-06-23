-- ============================================================
-- News push notifications
-- 1) economic_event_notifications : dedup log so each user is pushed
--    at most once per economic event (the notify cron runs every 10 min,
--    each event sits in the look-ahead window across several runs).
-- 2) profiles.push_notif_news : per-user opt-out for the news pre-alert.
-- ============================================================

CREATE TABLE IF NOT EXISTS economic_event_notifications (
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES economic_events(id) ON DELETE CASCADE,
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS economic_event_notifications_sent_idx
  ON economic_event_notifications(sent_at);

-- Written/read only by the cron (service role, bypasses RLS). Enabling RLS
-- with no policy means no authenticated client can touch it.
ALTER TABLE economic_event_notifications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE economic_event_notifications IS 'Dedup log: one row per (user, economic event) already pushed, so the news pre-alert fires once.';

-- Per-user opt-out for the economic-news pre-alert push (default on).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_notif_news BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN profiles.push_notif_news IS 'Push pre-alert before high/medium-impact economic announcements on the trader''s currencies.';
