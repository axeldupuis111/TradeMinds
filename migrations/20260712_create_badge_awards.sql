-- ============================================================
-- Table: badge_awards
-- Badges du classement devenus des ACQUIS persistants + récompenses.
-- Une ligne = un badge gagné une fois pour toutes (même si les stats
-- de la période redescendent ensuite : un badge ne se reperd pas).
--
-- Anti-triche : AUCUNE policy INSERT/UPDATE/DELETE pour authenticated.
-- Seul le serveur (service role, route /api/leaderboard) écrit ici,
-- à partir de stats recalculées côté serveur. Le client lit ses
-- propres awards (certificats, bonus de gels de série).
--
-- meta fige le contexte au moment de l'octroi (série atteinte, rang,
-- saison…) — c'est ce qui est imprimé sur le certificat PDF.
-- ============================================================
CREATE TABLE IF NOT EXISTS badge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB,

  -- Un badge ne peut être octroyé qu'une fois par utilisateur.
  CONSTRAINT badge_awards_user_badge_key UNIQUE (user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS badge_awards_user_id_idx ON badge_awards(user_id);

ALTER TABLE badge_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own badge awards"
  ON badge_awards FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE badge_awards IS 'Badges du classement acquis (persistants). Écrits uniquement par le service role depuis /api/leaderboard ; lus par leur propriétaire (certificats, bonus gels).';
COMMENT ON COLUMN badge_awards.meta IS 'Contexte figé à l''octroi (streak, rank, season…) — imprimé sur le certificat PDF.';
