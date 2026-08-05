-- ============================================================
-- broker_connections.commission_per_contract
--
-- L'API Tradovate ne renvoie jamais les frais : ses fills ne portent que le
-- prix. Le P&L calculé à partir des prix est donc BRUT, et sur des futures
-- prop firm (souvent 4 à 5 $ l'aller-retour par contrat) l'écart avec le
-- relevé du broker devient vite visible.
--
-- On stocke donc le coût aller-retour PAR CONTRAT saisi par l'utilisateur.
-- Valeur positive (un coût), convertie en `trades.commission` négatif au
-- moment de la synchro pour respecter la convention du reste de l'app :
--   net = pnl + commission + swap
--
-- 0 = comportement d'avant (P&L brut), donc la migration est sans effet sur
-- les connexions existantes tant que l'utilisateur ne renseigne rien.
-- ============================================================

ALTER TABLE broker_connections
  ADD COLUMN IF NOT EXISTS commission_per_contract NUMERIC NOT NULL DEFAULT 0
    CHECK (commission_per_contract >= 0 AND commission_per_contract <= 100);

COMMENT ON COLUMN broker_connections.commission_per_contract IS
  'Coût aller-retour par contrat, en devise du compte (valeur positive). Appliqué aux quantités effectivement clôturées et écrit en négatif dans trades.commission. 0 = P&L brut.';
