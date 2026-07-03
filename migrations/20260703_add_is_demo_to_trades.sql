-- ============================================================
-- trades.is_demo — mode démo (dashboard jamais vide).
--
-- Les nouveaux comptes sans trades peuvent injecter ~50 trades fictifs
-- (lib/demo-data.ts) pour découvrir l'app pleine. Marqués is_demo = true :
--   - affichés dans le dashboard/analytics/bilan (c'est le but) ;
--   - EXCLUS des surfaces sortantes (rapport hebdo email, profil public) ;
--   - purgés automatiquement au premier trade réel (import CSV, saisie
--     manuelle, sync MT/broker) via purgeDemoTrades().
--
-- ⚠️ À APPLIQUER AVANT de déployer le code : les requêtes serveur qui
-- filtrent .eq("is_demo", false) ont un fallback sans filtre, mais le
-- bouton « données démo » échouera tant que la colonne n'existe pas.
-- ============================================================
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- Purge ciblée peu coûteuse (index partiel : seules les lignes démo).
CREATE INDEX IF NOT EXISTS idx_trades_user_demo
ON trades (user_id)
WHERE is_demo;

COMMENT ON COLUMN trades.is_demo IS 'Trade fictif du mode démo (lib/demo-data.ts). Affiché dans l''app, exclu des emails/profils publics, purgé au premier trade réel.';
