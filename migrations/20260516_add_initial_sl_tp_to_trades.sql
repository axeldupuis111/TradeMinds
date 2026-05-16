ALTER TABLE trades
ADD COLUMN IF NOT EXISTS sl_initial NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tp_initial NUMERIC DEFAULT NULL;

COMMENT ON COLUMN trades.sl_initial IS 'SL au moment de l''ouverture du trade, saisi manuellement par l''utilisateur si différent du SL du CSV (typiquement quand le SL a été déplacé au BE pendant la vie du trade)';
COMMENT ON COLUMN trades.tp_initial IS 'TP au moment de l''ouverture du trade, saisi manuellement par l''utilisateur si différent du TP du CSV';
