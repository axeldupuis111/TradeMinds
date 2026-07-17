-- ============================================================
-- Analyse visuelle IA d'un trade : verdict de Claude (vision) sur le
-- screenshot annoté du graphique, persisté pour ne pas refacturer une
-- relecture. Écrit par /api/analyze-trade-vision (session utilisateur,
-- RLS existante de la table trades), lu par le TradeDetailPanel.
-- Shape du JSON : { setup_validity, grade, summary, what_works[],
-- what_lacks[], annotation_feedback, advice, analyzed_at, model }
-- ============================================================
ALTER TABLE trades ADD COLUMN IF NOT EXISTS vision_review JSONB;

COMMENT ON COLUMN trades.vision_review IS 'Verdict de l''analyse visuelle IA du screenshot (grade A-D, validité du setup, conseils). Null tant que le trader n''a pas lancé l''analyse.';
