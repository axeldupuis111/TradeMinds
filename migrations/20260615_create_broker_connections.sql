-- ============================================================
-- Table: broker_connections
-- Stores encrypted API credentials for API-based broker sync
-- (Tradovate today; extensible to other futures/CFD brokers).
-- Credentials are encrypted at the application layer (AES-256-GCM)
-- into a single JSON blob before being written here; the database
-- only ever sees ciphertext.
-- ============================================================
CREATE TABLE IF NOT EXISTS broker_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  broker TEXT NOT NULL CHECK (broker IN ('tradovate')),
  label TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('demo', 'live')),
  -- Encrypted JSON blob: { username, password, cid, sec } — never plaintext.
  credentials_encrypted TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disabled')),
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT broker_connections_user_broker_label_key UNIQUE (user_id, broker, label)
);

CREATE INDEX IF NOT EXISTS broker_connections_user_id_idx ON broker_connections(user_id);
CREATE INDEX IF NOT EXISTS broker_connections_active_idx
  ON broker_connections(status) WHERE status = 'active';

-- Row Level Security: users can only access their own connections.
ALTER TABLE broker_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own broker connections"
  ON broker_connections FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own broker connections"
  ON broker_connections FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own broker connections"
  ON broker_connections FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own broker connections"
  ON broker_connections FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Auto-update updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION update_broker_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS broker_connections_updated_at_trigger ON broker_connections;
CREATE TRIGGER broker_connections_updated_at_trigger
  BEFORE UPDATE ON broker_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_broker_connections_updated_at();

COMMENT ON TABLE broker_connections IS 'Encrypted API credentials for API-based broker trade sync (Tradovate). Ciphertext only — decryption happens server-side.';
COMMENT ON COLUMN broker_connections.broker IS 'Broker identifier: tradovate';
COMMENT ON COLUMN broker_connections.environment IS 'Tradovate environment: demo or live (different API hosts).';
COMMENT ON COLUMN broker_connections.credentials_encrypted IS 'AES-256-GCM encrypted JSON { username, password, cid, sec } — never stored in plaintext.';
COMMENT ON COLUMN broker_connections.status IS 'Connection health: active (working), error (last sync failed), disabled (paused by user).';

-- ============================================================
-- trades.source — document the push-rail + pull-rail sources.
-- (No CHECK constraint on trades.source by design; this is documentation only.)
-- ============================================================
COMMENT ON COLUMN trades.source IS 'Origin of the trade: manual, csv, mt4, mt5, ctrader, ninjatrader, tradovate, binance, bybit, okx, bitget';
