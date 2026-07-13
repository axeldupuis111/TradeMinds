-- ============================================================
-- Défis communautaires HEBDOMADAIRES : rotation + résultats + récompenses.
--
-- 1) challenge_participations devient scopé par semaine ISO (week_key
--    "2026-W29") : les défis tournent chaque lundi, donc rejoindre le défi
--    « clean-days » de la semaine 29 n'inscrit pas aux tirages suivants.
--    Les anciennes lignes (défis permanents v1) gardent week_key = '' et ne
--    matchent plus jamais — archivées de fait.
--
-- 2) challenge_awards : résultats FIGÉS à la clôture d'une semaine.
--    Anti-triche, même modèle que badge_awards : AUCUNE policy d'écriture
--    pour authenticated — seul le service role (route /api/community-challenges,
--    clôture paresseuse) écrit, à partir de stats recalculées côté serveur.
--    Récompenses dérivées de ces lignes :
--      completed = true  → +1 gel de série le mois de l'octroi (plafonné) ;
--      rank 1..3         → emblème 👑/🥈/🥉 sur le classement la semaine suivante ;
--      rank = 1          → certificat PDF « champion de la semaine ».
--
-- 3) challenge_week_closures : marqueur d'idempotence de la clôture (les
--    awards sont upsertés AVANT le marqueur : un crash entre les deux ne perd
--    rien, la clôture est rejouée et l'unique contrainte déduplique).
-- ============================================================

ALTER TABLE challenge_participations
  ADD COLUMN IF NOT EXISTS week_key TEXT NOT NULL DEFAULT '';

ALTER TABLE challenge_participations
  DROP CONSTRAINT IF EXISTS challenge_participations_pkey;

ALTER TABLE challenge_participations
  ADD PRIMARY KEY (user_id, challenge_key, week_key);

CREATE TABLE IF NOT EXISTS challenge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL,
  challenge_key TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  -- Rang de compétition (égalités partagées) parmi les participants ayant
  -- progressé ; NULL si aucun podium (moins de 3 participants actifs).
  rank INT,
  -- Progression finale (entier affiché) et score de classement (décimales).
  progress INT NOT NULL DEFAULT 0,
  score NUMERIC,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT challenge_awards_user_week_challenge UNIQUE (user_id, week_key, challenge_key)
);

CREATE INDEX IF NOT EXISTS challenge_awards_week_idx ON challenge_awards(week_key);
CREATE INDEX IF NOT EXISTS challenge_awards_user_idx ON challenge_awards(user_id);

ALTER TABLE challenge_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own challenge awards"
  ON challenge_awards FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS challenge_week_closures (
  week_key TEXT PRIMARY KEY,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE challenge_week_closures ENABLE ROW LEVEL SECURITY;
-- Pas de policy : lue/écrite uniquement par le service role.

COMMENT ON TABLE challenge_awards IS 'Résultats hebdo figés des défis communautaires. Écrits uniquement par le service role à la clôture ; lus par leur propriétaire (gels bonus, rang, certificat).';
COMMENT ON TABLE challenge_week_closures IS 'Marqueur d''idempotence : semaine ISO déjà clôturée (awards écrits).';
COMMENT ON COLUMN challenge_participations.week_key IS 'Semaine ISO du tirage (ex. 2026-W29). '''' = anciennes participations v1 (défis permanents), archivées.';
