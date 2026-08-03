-- ============================================================
-- GESTION D'UNE COMMUNAUTÉ PARTENAIRE : retrait de membre + édition de défi.
--
-- Complète 20260731_partner_communities.sql, qui posait la mécanique (membres,
-- défis privés, classement honorifique) mais laissait deux trous : l'animateur
-- ne pouvait NI voir qui étaient ses membres, NI en retirer un, et un défi mal
-- rédigé ne pouvait que se supprimer.
-- ============================================================

-- Un retrait doit tenir : sans trace, le membre retiré retape le code de la
-- communauté (c'est le slug public du lien d'affiliation, il le connaît) et
-- revient dans la seconde. On garde donc la trace du retrait à part, plutôt
-- qu'un drapeau sur community_members : la ligne d'appartenance disparaît bel
-- et bien, et le blocage lui survit.
--
-- Le blocage est par COMMUNAUTÉ, pas global : être retiré de chez un partenaire
-- ne doit rien coûter chez un autre, ni sur le reste de l'app.
CREATE TABLE IF NOT EXISTS community_blocks (
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  -- Qui a retiré : l'animateur, ou un admin depuis /dashboard/admin.
  blocked_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  blocked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_blocks_user_idx ON community_blocks(user_id);

ALTER TABLE community_blocks ENABLE ROW LEVEL SECURITY;
-- Aucune policy, comme les trois autres tables : tout passe par le service role
-- (routes /api/community et /api/admin/communities), qui vérifie que l'appelant
-- est bien l'animateur de CETTE communauté.

COMMENT ON TABLE community_blocks IS
  'Membres retirés d''une communauté : empêche le retour par saisie du code (le slug est public).';

-- Un défi se corrige au lieu de se supprimer : une faute de frappe dans le
-- titre ne doit pas coûter le classement déjà en cours. La colonne sert aussi
-- à afficher « modifié le… » aux membres, pour qu'une cible changée en cours de
-- route ne passe pas inaperçue.
ALTER TABLE community_challenges
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

COMMENT ON COLUMN community_challenges.updated_at IS
  'Dernière modification par l''animateur (NULL si jamais modifié depuis la création).';
