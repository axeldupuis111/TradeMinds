-- Add stripe_customer_id to profiles table
-- Required for Stripe Checkout integration
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add unique index (one Stripe customer = one Supabase user)
-- Partial index: only indexes rows where stripe_customer_id is set
CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
ON profiles(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- Documentation
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe Customer ID (cus_xxx). Set after first checkout session. Unique per user.';
