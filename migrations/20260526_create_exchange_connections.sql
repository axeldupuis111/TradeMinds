-- ============================================================
-- Table: exchange_connections
-- Stores encrypted API credentials for crypto exchange sync.
-- Credentials are encrypted at the application layer (AES-256-GCM)
-- before being written here; the database only sees ciphertext.
-- ============================================================
CREATE TABLE IF NOT EXISTS exchange_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exchange TEXT NOT NULL CHECK (exchange IN ('binance', 'bybit', 'okx', 'bitget')),
  label TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  passphrase_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disabled')),
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT exchange_connections_user_exchange_label_key UNIQUE (user_id, exchange, label)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS exchange_connections_user_id_idx ON exchange_connections(user_id);

-- Row Level Security: users can only access their own connections
ALTER TABLE exchange_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own exchange connections"
  ON exchange_connections
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own exchange connections"
  ON exchange_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own exchange connections"
  ON exchange_connections
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own exchange connections"
  ON exchange_connections
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_exchange_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exchange_connections_updated_at_trigger ON exchange_connections;
CREATE TRIGGER exchange_connections_updated_at_trigger
  BEFORE UPDATE ON exchange_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_exchange_connections_updated_at();

-- Documentation
COMMENT ON TABLE exchange_connections IS 'Encrypted API credentials for automatic trade sync with crypto exchanges. Ciphertext only — decryption happens server-side.';
COMMENT ON COLUMN exchange_connections.exchange IS 'Exchange identifier: binance, bybit, okx, bitget';
COMMENT ON COLUMN exchange_connections.label IS 'User-chosen display name for this connection (e.g. "Perso", "FTMO")';
COMMENT ON COLUMN exchange_connections.api_key_encrypted IS 'AES-256-GCM encrypted API key — never stored in plaintext';
COMMENT ON COLUMN exchange_connections.api_secret_encrypted IS 'AES-256-GCM encrypted API secret — never stored in plaintext';
COMMENT ON COLUMN exchange_connections.passphrase_encrypted IS 'AES-256-GCM encrypted passphrase, required by OKX and Bitget, NULL for others';
COMMENT ON COLUMN exchange_connections.status IS 'Connection health: active (working), error (last sync failed), disabled (paused by user)';
COMMENT ON COLUMN exchange_connections.last_synced_at IS 'Timestamp of the last successful trade sync';
COMMENT ON COLUMN exchange_connections.last_error IS 'Human-readable error message from the last failed sync attempt';

-- ============================================================
-- ALTER TABLE trades: add provenance columns for synced trades
-- ============================================================
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS trades_user_source_external_id_key
  ON trades (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

COMMENT ON COLUMN trades.source IS 'Origin of the trade: manual, csv, binance, bybit, okx, bitget';
COMMENT ON COLUMN trades.external_id IS 'Unique trade identifier from the exchange (e.g. Binance tradeId). NULL for manual/CSV imports.';
