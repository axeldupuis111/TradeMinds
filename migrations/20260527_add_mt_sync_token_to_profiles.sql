-- Add mt_sync_token to profiles table
-- Used by MetaTrader Expert Advisors to authenticate trade sync requests.
-- The token is a random cryptographic string generated server-side.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS mt_sync_token TEXT;

-- Unique partial index: guarantees no two users share the same token,
-- while allowing unlimited NULLs (users who haven't generated a token yet).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_mt_sync_token_idx
ON profiles(mt_sync_token)
WHERE mt_sync_token IS NOT NULL;

-- Documentation
COMMENT ON COLUMN profiles.mt_sync_token IS 'Random sync token (mt_<hex>) used by MetaTrader EA to authenticate. NULL until the user generates one. Unique across all users.';
