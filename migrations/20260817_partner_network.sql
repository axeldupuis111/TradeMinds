-- ============================================================
-- RÉSEAUX PARTENAIRES : découpler l'ATTRIBUTION de la REMISE.
--
-- POURQUOI. Jusqu'ici, suivre un apporteur d'affaires imposait de lui créer un
-- code promo Stripe à la main : le code ÉTAIT la remise, on ne pouvait pas
-- tracer quelqu'un sans lui fabriquer un objet Stripe. Ça tient pour trois
-- influenceurs. Ça ne tient pas pour un réseau de plusieurs milliers de
-- collaborateurs, et surtout ça ne dit jamais À QUI appartient un code : le
-- rapport de commissions ne sait afficher qu'une chaîne de caractères
-- (« XANALYSE »), le lien avec la personne vit dans le dashboard Stripe.
--
-- Après cette migration :
--  - un code d'apporteur est une LIGNE (partner_reps), créée en base, gratuite
--    et instantanée : 5 000 collaborateurs coûtent 5 000 lignes, zéro objet
--    Stripe et zéro création à la main ;
--  - la remise éventuelle est UN coupon par PARTENAIRE (partners.stripe_coupon_id),
--    pas un par collaborateur ;
--  - l'attribution est écrite dès l'INSCRIPTION (referral_attributions), plus
--    seulement au paiement : un compte gratuit qui convertit trois mois plus
--    tard revient au bon collaborateur ;
--  - chaque encaissement laisse une ligne (commission_events), donc le relevé
--    mensuel est une agrégation SQL et non un balayage de toute l'API Stripe.
--
-- COMPATIBILITÉ. Les trois influenceurs actuels sont repris tels quels, en bas
-- de fichier : un partenaire, un collaborateur unique portant leur code
-- historique. Leurs abonnements en cours gardent leur `metadata.promo_code` et
-- continuent d'être lus par l'onglet Affiliation. Aucune ré-attribution, aucune
-- remise recréée : leur coupon Stripe reste résolu par son code, comme avant.
--
-- Écritures réservées au service role, comme communities : RLS active, aucune
-- policy. Les collaborateurs lisent leurs chiffres via une route serveur qui
-- filtre sur leur jeton, jamais en direct.
-- ============================================================

-- ── Le partenaire : un réseau, ou un influenceur isolé ────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Slug public du partenaire lui-même (`?ref=lml`), sur le modèle de
  -- communities.slug. Toujours en minuscules.
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- 'network' = société qui redistribue à ses collaborateurs (un seul contrat,
  -- une seule facture, un seul virement) ; 'influencer' = personne payée en
  -- direct, le modèle historique.
  kind TEXT NOT NULL DEFAULT 'influencer' CHECK (kind IN ('influencer', 'network')),
  -- Préfixe des codes collaborateurs (« LML » -> « LML-7K3P »). Le préfixe est
  -- ce qui garantit qu'un code de réseau n'entrera jamais en collision avec un
  -- code historique tapé à la main.
  rep_prefix TEXT,
  -- Coupon Stripe appliqué aux filleuls de CE partenaire, quel que soit le
  -- collaborateur. NULL = le lien ne donne aucune remise (cas par défaut d'un
  -- réseau : on ne paie pas deux fois, en commission ET en rabais).
  stripe_coupon_id TEXT,
  -- Code SECRET que le partenaire diffuse à ses collaborateurs pour qu'ils
  -- s'inscrivent eux-mêmes. Distinct du slug public, régénérable s'il fuite.
  -- Même raisonnement que communities.join_code.
  join_code TEXT UNIQUE,
  -- NULL = barème progressif du contrat (20/25/30 selon les abonnés actifs).
  -- Renseigné = taux fixe négocié, appliqué tel quel.
  flat_rate NUMERIC(4, 3) CHECK (flat_rate > 0 AND flat_rate <= 0.5),
  -- Compte TradeDiscipline du partenaire, s'il en a un (consultation de ses
  -- chiffres). NULL tant qu'il n'a pas créé son compte.
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Le collaborateur : une ligne, pas un objet Stripe ────────────────────────
CREATE TABLE IF NOT EXISTS partner_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  -- Code d'attribution, en MAJUSCULES, unique toutes sociétés confondues :
  -- c'est lui qui voyage dans `?ref=` et qui est gravé dans les metadata Stripe.
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  -- Consultation de SES chiffres sans créer de compte : l'URL porte le jeton.
  -- Un collaborateur qui doit s'inscrire pour voir trois nombres ne s'inscrit
  -- pas, et on ne veut pas construire une authentification de plus.
  stats_token TEXT NOT NULL UNIQUE,
  -- Acceptation de la charte (aucune promesse de gain, aucun signal). Sans
  -- date, le collaborateur n'est pas activable : c'est notre seule preuve.
  charter_accepted_at TIMESTAMPTZ,
  -- Renseigné si le collaborateur est aussi utilisateur : sert à bloquer
  -- l'auto-parrainage.
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_reps_partner_idx ON partner_reps(partner_id);
CREATE INDEX IF NOT EXISTS partner_reps_user_idx ON partner_reps(user_id) WHERE user_id IS NOT NULL;

-- ── Qui a amené qui, verrouillé au premier contact ───────────────────────────
-- Clé primaire sur user_id : un trader appartient à UN apporteur, le premier
-- lien cliqué fait foi. Même règle que community_members, pour la même raison :
-- deux apporteurs qui revendiquent la même vente n'auraient aucun sens.
CREATE TABLE IF NOT EXISTS referral_attributions (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  rep_id UUID REFERENCES partner_reps(id) ON DELETE SET NULL,
  -- Code tel que capté, conservé même s'il ne résout vers aucun collaborateur
  -- (code historique, code désactivé depuis) : sans lui, une attribution
  -- perdue est indébogable.
  code TEXT NOT NULL,
  -- 'signup' = lien cliqué puis compte créé ; 'checkout' = code saisi au
  -- paiement par quelqu'un qui avait déjà un compte.
  source TEXT NOT NULL DEFAULT 'signup' CHECK (source IN ('signup', 'checkout')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_attributions_rep_idx ON referral_attributions(rep_id);
CREATE INDEX IF NOT EXISTS referral_attributions_partner_idx ON referral_attributions(partner_id);

-- ── Les encaissements, ligne à ligne ─────────────────────────────────────────
-- Une commission n'existe que si l'argent est réellement rentré. Un
-- remboursement écrit une ligne NÉGATIVE plutôt que d'effacer la première :
-- l'historique doit rester lisible six mois plus tard, quand le partenaire
-- conteste un montant.
CREATE TABLE IF NOT EXISTS commission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Idempotence : le webhook Stripe rejoue ses événements. « paid:in_123 » et
  -- « refund:in_123 » sont deux lignes distinctes, chacune écrite une fois.
  event_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('payment', 'refund')),
  invoice_id TEXT NOT NULL,
  subscription_id TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  rep_id UUID REFERENCES partner_reps(id) ON DELETE SET NULL,
  code TEXT,
  -- Encaissé en centimes. Négatif pour une reprise.
  amount_cents INT NOT NULL,
  -- Dans les 12 premiers mois de l'abonnement (assiette contractuelle). Figé à
  -- l'écriture : recalculer l'éligibilité des mois passés ferait bouger un
  -- relevé déjà envoyé.
  eligible BOOLEAN NOT NULL DEFAULT true,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commission_events_partner_idx ON commission_events(partner_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS commission_events_rep_idx ON commission_events(rep_id, occurred_at DESC);

ALTER TABLE partners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_reps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_events     ENABLE ROW LEVEL SECURITY;

-- Aucune policy : tout passe par le service role. De l'argent transite par ces
-- tables, aucun client ne doit pouvoir les lire ni les écrire en direct.

-- ── Reprise des trois partenaires historiques ────────────────────────────────
-- Un influenceur devient un partenaire à collaborateur unique, dont le code est
-- son code promo Stripe existant. La logique d'attribution et de commission
-- devient ainsi la MÊME pour tout le monde, sans toucher à leurs coupons : la
-- remise de ces codes-là reste résolue chez Stripe, par son code (lib/founding).
DO $$
DECLARE
  histo   RECORD;
  pid     UUID;
  alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  token   TEXT;
  i       INT;
BEGIN
  FOR histo IN
    SELECT * FROM (VALUES
      ('xanalyse',         'XAnalyse',         'XANALYSE'),
      ('trader1compris',   'Trader1Compris',   'TRADER1COMPRIS'),
      ('gdinvest',         'GD Invest',        'GDINVEST')
    ) AS t(slug, name, code)
  LOOP
    INSERT INTO partners (slug, name, kind)
    VALUES (histo.slug, histo.name, 'influencer')
    ON CONFLICT (slug) DO NOTHING;

    SELECT id INTO pid FROM partners WHERE slug = histo.slug;

    token := '';
    FOR i IN 1..24 LOOP
      token := token || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    END LOOP;

    INSERT INTO partner_reps (partner_id, code, display_name, stats_token, charter_accepted_at)
    VALUES (pid, histo.code, histo.name, token, now())
    ON CONFLICT (code) DO NOTHING;
  END LOOP;
END $$;

COMMENT ON TABLE partners IS 'Réseau ou influenceur. Un contrat, une facture, un virement : le réseau redistribue lui-même à ses collaborateurs.';
COMMENT ON TABLE partner_reps IS 'Apporteur d''affaires. Le code est une ligne en base, jamais un objet Stripe : créer 5 000 collaborateurs coûte 5 000 INSERT.';
COMMENT ON TABLE referral_attributions IS 'Qui a amené qui, verrouillé au premier contact et écrit dès l''inscription (pas au paiement).';
COMMENT ON TABLE commission_events IS 'Encaissements attribués, ligne à ligne. Un remboursement ajoute une ligne négative, il n''efface jamais.';
