-- ============================================================
-- product_events — funnel d'activation minimal (auto-hébergé, zéro
-- dépendance externe type PostHog).
--
-- Événements écrits par lib/track.ts (fire-and-forget, jamais bloquant) :
--   demo_loaded, csv_imported, manual_trade_added, analysis_run,
--   checkout_started. L'inscription n'a pas d'événement : elle se lit
--   dans profiles.created_at.
--
-- Lecture : /api/admin/funnel (service role) → onglet Funnel de la page
-- admin. RLS : un utilisateur ne peut qu'insérer SES événements ; aucune
-- lecture côté client.
-- ============================================================
CREATE TABLE IF NOT EXISTS product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_events_event_date
ON product_events (event, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_user
ON product_events (user_id);

ALTER TABLE product_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert own events" ON product_events;
CREATE POLICY "insert own events" ON product_events
FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE product_events IS 'Funnel produit minimal (lib/track.ts) : demo_loaded, csv_imported, manual_trade_added, analysis_run, checkout_started. Lu par /api/admin/funnel.';
