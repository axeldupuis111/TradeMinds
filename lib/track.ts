/**
 * Tracking produit minimal — auto-hébergé (table product_events), zéro
 * dépendance externe, zéro cookie tiers (rien à ajouter à la politique de
 * confidentialité : données propres, user connecté, finalité produit).
 *
 * track() est fire-and-forget : jamais d'await nécessaire au call site,
 * jamais d'erreur remontée (si la migration n'est pas appliquée, l'app
 * fonctionne exactement pareil). Un événement = un fait d'activation :
 *   demo_loaded · csv_imported · manual_trade_added · analysis_run ·
 *   checkout_started
 * L'inscription se lit dans profiles.created_at (pas d'événement dédié).
 */

import { createClient } from "@/lib/supabase/client";

export type ProductEvent =
  | "demo_loaded"
  | "csv_imported"
  | "manual_trade_added"
  | "analysis_run"
  | "checkout_started";

export function track(event: ProductEvent, meta?: Record<string, unknown>): void {
  try {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      return supabase
        .from("product_events")
        .insert({ user_id: user.id, event, meta: meta ?? null })
        .then(({ error }) => {
          // Colonne/table absente (migration non appliquée) → silencieux.
          if (error && !/product_events/.test(error.message)) {
            console.warn("[track] insert failed:", error.message);
          }
        });
    });
  } catch {
    // Le tracking ne casse JAMAIS un parcours utilisateur.
  }
}
