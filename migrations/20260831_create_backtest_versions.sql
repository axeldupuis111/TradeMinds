-- ============================================================
-- Table: backtest_versions
-- Une version de stratégie testée, archivée telle qu'elle a été
-- mesurée : le plan complet, l'écart avec la fiche d'origine, le
-- résumé du résultat, et le contrôle sur une période qui n'avait
-- pas servi à trouver les réglages.
--
-- Pourquoi archiver, alors que la fiche est déjà mise à jour :
-- la fiche ne garde que les quelques réglages qui ont une case
-- chiffrée (risque par trade, pertes d'affilée, trades par jour,
-- objectif en R). Un plan de backtest en compte une trentaine.
-- Sans cette table, tout ce qui n'a pas de case (largeur de pivot,
-- épaisseur de trendline, plage horaire, unité de temps) serait
-- perdu à la fermeture de l'onglet, et le trader ne pourrait plus
-- ni comparer deux essais ni retrouver ce qu'il avait mesuré.
--
-- ⚠️ AUCUN CHIFFRE ICI N'EST UNE PERFORMANCE RÉALISÉE. `resume`
-- contient un résultat HYPOTHÉTIQUE, obtenu en rejouant des bougies
-- passées. Rien dans le produit ne doit l'agréger avec le journal
-- de trades réels, ni le faire remonter dans le classement.
-- ============================================================
CREATE TABLE IF NOT EXISTS backtest_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- La fiche dont ces réglages sont issus. Mise à NULL si elle est
  -- supprimée : la mesure reste lisible, elle perd juste son origine.
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,

  instrument TEXT NOT NULL,
  -- Fenêtre testée, en mois "YYYY-MM".
  periode_de TEXT NOT NULL,
  periode_a TEXT NOT NULL,

  -- Le plan d'exécution complet, tel que le moteur l'a reçu.
  plan JSONB NOT NULL,
  -- L'écart avec le plan compilé depuis la fiche, ligne par ligne.
  modifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Verdict, nombre de trades, espérance, intervalle, nombre de rejeux.
  resume JSONB NOT NULL,
  -- Le contrôle sur une période intacte. NULL quand il n'a pas eu lieu.
  controle JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backtest_versions_user_id_idx
  ON backtest_versions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS backtest_versions_strategy_id_idx
  ON backtest_versions(strategy_id);

-- Row Level Security : un trader ne voit que ses propres versions.
ALTER TABLE backtest_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own backtest versions"
  ON backtest_versions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own backtest versions"
  ON backtest_versions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own backtest versions"
  ON backtest_versions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE backtest_versions IS 'Versions de stratégie testées et archivées. Resultats HYPOTHETIQUES issus du rejeu de bougies passees : ne jamais agreger avec les trades reels.';
COMMENT ON COLUMN backtest_versions.modifications IS 'Ecart avec le plan compile depuis la fiche : cle du reglage, avant, apres, origine (proposition/manuel) et objectif declare.';
COMMENT ON COLUMN backtest_versions.controle IS 'Rejeu du meme plan sur une periode qui n a pas servi a trouver les reglages. NULL quand le controle n a pas ete fait.';
