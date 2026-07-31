-- ============================================================
-- COMMUNAUTÉS PARTENAIRES + défis privés.
--
-- Un partenaire (influenceur, coach) anime une communauté : les traders
-- inscrits via son lien `?ref=<slug>` la rejoignent automatiquement, et lui
-- seul peut y créer des défis. Ces défis ne sont visibles QUE par les membres
-- de la communauté, à côté des défis hebdo publics (lib/community-challenges).
--
-- Différences volontaires avec les défis hebdo publics :
--  1) le défi est stocké EN BASE (créé par un humain) au lieu d'être tiré au
--     sort dans un pool codé en dur ;
--  2) la métrique reste choisie parmi celles que le serveur sait calculer
--     (lib/community.ts) : aucune métrique libre, donc aucun défi basé sur le
--     P&L — invérifiable, et interdit par la clause « pas de promesses de
--     gains » du contrat de partenariat ;
--  3) AUCUNE récompense matérielle (ni gel de série, ni certificat, ni badge) :
--     le créateur du défi n'est pas neutre, il pourrait fabriquer un objectif
--     trivial et distribuer des gels à l'infini. Le classement privé est
--     honorifique.
--
-- Pas de table de participation : tout membre de la communauté est classé
-- d'office sur ses défis. Sur une communauté de 20 personnes, un tableau vide
-- en attente de « rejoindre » tuerait la mécanique.
--
-- Écritures réservées au service role (routes /api/community, /api/admin/...),
-- comme challenge_awards : les scores sont recalculés côté serveur à partir des
-- trades et des séances, jamais postés par le client.
-- ============================================================

CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Slug du lien d'affiliation (`?ref=infx`) : c'est lui qui rattache
  -- automatiquement les inscrits. Toujours en minuscules.
  slug TEXT NOT NULL UNIQUE,
  -- Nom affiché aux membres (« INFX »).
  name TEXT NOT NULL,
  -- Compte TradeDiscipline du partenaire : le seul autorisé à créer des défis.
  -- NULL tant qu'il n'a pas créé son compte (la communauté existe déjà et
  -- collecte ses membres).
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communities_owner_idx ON communities(owner_id);

-- Un trader appartient à UNE communauté (clé primaire sur user_id) : deux
-- classements privés concurrents n'auraient aucun sens côté produit, et le
-- premier lien cliqué fait foi, comme l'attribution marketing (first-touch).
CREATE TABLE IF NOT EXISTS community_members (
  user_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  -- 'referral' = rattachement auto via le lien, 'code' = saisie manuelle du
  -- code, 'owner' = le partenaire lui-même.
  source       TEXT NOT NULL DEFAULT 'code',
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_members_community_idx ON community_members(community_id);

CREATE TABLE IF NOT EXISTS community_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  -- Une des métriques de COMMUNITY_METRICS (lib/community.ts). Validée par
  -- l'API : la base ne fige pas la liste pour ne pas imposer une migration à
  -- chaque nouvelle métrique.
  metric       TEXT NOT NULL,
  target       INT NOT NULL CHECK (target > 0),
  -- Bornes INCLUSIVES, en dates locales (le découpage par jour se fait ensuite
  -- dans le fuseau de chaque participant, comme les défis hebdo).
  starts_on    DATE NOT NULL,
  ends_on      DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT community_challenges_range CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS community_challenges_community_idx
  ON community_challenges(community_id, ends_on DESC);

ALTER TABLE communities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_challenges ENABLE ROW LEVEL SECURITY;

-- Aucune policy : tout passe par le service role. Les membres lisent la
-- communauté et ses défis via /api/community, qui filtre sur LEUR appartenance
-- (un membre ne peut pas lire les défis d'une autre communauté).

COMMENT ON TABLE communities IS 'Communauté animée par un partenaire ; slug = celui du lien d''affiliation (?ref=).';
COMMENT ON TABLE community_members IS 'Appartenance unique d''un trader à une communauté (first-touch).';
COMMENT ON TABLE community_challenges IS 'Défis privés créés par le partenaire, visibles des seuls membres. Métrique restreinte (jamais le P&L), aucune récompense matérielle.';
