-- ============================================================
-- Mode démo complet — un nouvel inscrit visite l'app pleine.
--
-- Jusqu'ici seuls les trades étaient injectables (is_demo sur trades,
-- migration 20260703). Le mode démo devient un ÉTAT du compte, pour que
-- l'app puisse aussi servir une analyse IA, une analyse macro et un débrief
-- fictifs (fixtures en dur dans lib/demo-fixtures.ts, aucun appel IA, aucun
-- quota consommé) et afficher les bandeaux « données de démonstration ».
--
-- Ligne de partage volontaire :
--   - lignes réelles taguées is_demo : trades, strategies, prop_challenges.
--     Nécessaire, l'app calcule tout depuis ces tables et les trades portent
--     un strategy_id / challenge_id.
--   - fixtures jamais écrites en base : analyse IA, macro, débrief, coach.
--   - JAMAIS de ligne démo dans session_reviews, badge_awards,
--     challenge_participations : elles alimentent le CLASSEMENT public et les
--     récompenses. Une session démo ferait entrer un compte fictif dans le
--     vrai classement (app/api/leaderboard/route.ts agrège
--     session_reviews.discipline_score).
--
-- Fail-open : sans cette migration, le mode démo refuse de démarrer et
-- affiche l'erreur Postgres ; le reste de l'app est intact.
-- ============================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS demo_mode BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE strategies
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE prop_challenges
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- Purges ciblées peu coûteuses (index partiels : seules les lignes démo).
CREATE INDEX IF NOT EXISTS idx_strategies_user_demo
ON strategies (user_id)
WHERE is_demo;

CREATE INDEX IF NOT EXISTS idx_prop_challenges_user_demo
ON prop_challenges (user_id)
WHERE is_demo;

COMMENT ON COLUMN profiles.demo_mode IS 'Le compte visite l''app en mode démonstration : fixtures servies pour l''IA/macro/débrief, bandeaux affichés, aucun quota consommé. Sortie = purge des lignes is_demo + retour à false.';
COMMENT ON COLUMN strategies.is_demo IS 'Stratégie fictive du mode démo (lib/demo-data.ts), purgée à la sortie du mode démo et au premier trade réel.';
COMMENT ON COLUMN prop_challenges.is_demo IS 'Compte de trading fictif du mode démo (lib/demo-data.ts), purgé à la sortie du mode démo et au premier trade réel.';
