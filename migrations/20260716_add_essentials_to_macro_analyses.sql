-- ============================================================
-- macro_analyses : ajoute la synthèse scannable du briefing quotidien.
--   tldr      : ["puce ultra-courte", ...] — l'essentiel en 3-4 puces (20 s de lecture)
--   sentiment : 'risk_on' | 'risk_off' | 'neutral' | 'mixed' — climat de la séance
--   assets    : [{ "asset": "equities|dollar|rates|gold|oil|crypto",
--                  "direction": "up|down|flat|volatile", "note": "..." }, ...]
--               — dynamiques attendues par classe d'actifs (informatif, jamais un conseil)
-- Rétro-compatible : les lignes existantes gardent des valeurs vides et la page
-- retombe sur l'affichage complet d'origine.
-- ============================================================

ALTER TABLE macro_analyses
  ADD COLUMN IF NOT EXISTS tldr      JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sentiment TEXT,
  ADD COLUMN IF NOT EXISTS assets    JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN macro_analyses.tldr IS 'JSON array of short strings — the whole briefing in 3-4 bullets.';
COMMENT ON COLUMN macro_analyses.sentiment IS 'Dominant risk appetite for the session: risk_on / risk_off / neutral / mixed.';
COMMENT ON COLUMN macro_analyses.assets IS 'JSON array of {asset, direction, note} — expected dynamics per asset class (informational, never a recommendation).';
