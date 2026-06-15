-- Add language to profiles table
-- Stores the user's preferred UI language so server-side jobs (cron emails like
-- the daily session reminder and the weekly report) can send content in the
-- account's language. Until now the language lived only in the browser
-- (localStorage + NEXT_LOCALE cookie) and was invisible to the backend.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

COMMENT ON COLUMN profiles.language IS 'Preferred UI language (fr | en | de | es). Synced from the client whenever the user picks a language. Used by cron email jobs to localize content. Defaults to en.';
