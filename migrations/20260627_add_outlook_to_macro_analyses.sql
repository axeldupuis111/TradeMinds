-- ============================================================
-- macro_analyses : ajoute la section "outlook" (impacts attendus par horizon).
-- { "today": "...", "days": "...", "months": "..." } — dynamiques de marché
-- attendues à la séance du jour, sur les prochains jours, et sur les prochaines
-- semaines/mois. Concret sur les classes d'actifs mais informatif (jamais un
-- conseil / une recommandation de position).
-- Rétro-compatible : défaut '{}' pour les lignes déjà présentes.
-- ============================================================

ALTER TABLE macro_analyses
  ADD COLUMN IF NOT EXISTS outlook JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN macro_analyses.outlook IS 'Impacts/dynamiques de marché attendus par horizon : {today, days, months}. Informatif, jamais une recommandation.';
