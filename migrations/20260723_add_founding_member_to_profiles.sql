-- ============================================================
-- Offre « Membre fondateur » : les 100 premiers abonnés Plus (mensuel)
-- bénéficient d'un premier mois à tarif d'appel (coupon Stripe -11,99 €,
-- duration=once, max_redemptions=100). Ces deux colonnes marquent le statut
-- à vie (badge + comptage des places restantes).
--
-- founding_member : posé à true par le webhook Stripe sur la PREMIÈRE
--   facture payée d'une souscription dont metadata.founding === 'true'
--   (paiement confirmé, jamais sur simple création de session de checkout).
-- founding_since  : horodatage d'octroi, écrit une seule fois (idempotent).
-- ============================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS founding_member BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS founding_since TIMESTAMPTZ;

-- Comptage rapide des places consommées (le checkout et /api/founding/slots
-- ne comptent que les lignes à true).
CREATE INDEX IF NOT EXISTS profiles_founding_member_idx
ON profiles(founding_member)
WHERE founding_member = true;

COMMENT ON COLUMN profiles.founding_member IS 'Membre fondateur (1 des 100 premiers abonnés Plus mensuel via l''offre d''appel). Posé par le webhook Stripe sur invoice.paid (subscription_create) si subscription.metadata.founding=true.';
COMMENT ON COLUMN profiles.founding_since IS 'Date d''octroi du statut de membre fondateur. Écrit une seule fois (idempotent).';
