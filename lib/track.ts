/**
 * Tracking produit minimal — auto-hébergé (table product_events), zéro
 * dépendance externe, zéro cookie tiers (rien à ajouter à la politique de
 * confidentialité : données propres, user connecté, finalité produit).
 *
 * track() est fire-and-forget : jamais d'await nécessaire au call site,
 * jamais d'erreur remontée (si la migration n'est pas appliquée, l'app
 * fonctionne exactement pareil). Un événement = un fait d'activation :
 *   demo_loaded · csv_imported · manual_trade_added · analysis_run ·
 *   checkout_started · taster_used · upgrade_cta_clicked
 * L'inscription se lit dans profiles.created_at (pas d'événement dédié).
 *
 * upgrade_cta_clicked porte meta.source (countdown · teaser_coach ·
 * teaser_debrief · teaser_weekly · taster_footer) pour savoir QUEL
 * déclencheur de l'échelle d'upgrade convertit.
 */

import { createClient } from "@/lib/supabase/client";

export type ProductEvent =
  | "demo_loaded"
  | "csv_imported"
  | "manual_trade_added"
  | "analysis_run"
  // Suites de l'analyse nouvelle génération (2026-07-17)
  | "analysis_pdf_export"
  | "analysis_plan_goals_created"
  | "checkout_started"
  // Échelle d'upgrade free→plus (2026-07-09)
  | "taster_used"
  | "upgrade_cta_clicked"
  // Attribution marketing : inscription rattachée à une source (meta.source =
  // utm_source du premier contact, ex. pseudo d'un influenceur) (2026-07-14)
  | "signup_attributed"
  // ── Le coach qui parle le premier (2026-08-25) ──
  //
  // ⚠️ CES DEUX ÉVÉNEMENTS SONT LA RAISON D'ÊTRE DE LA FONCTIONNALITÉ, PAS UN
  // BONUS. Elle a été construite pour répondre à un chiffre mesuré : 4 messages
  // coach en 30 jours pour 12 abonnés payants. La livrer sans mesurer si elle
  // change quoi que ce soit reproduirait exactement l'erreur qu'elle prétend
  // corriger, et on en reparlerait dans trois mois en devinant.
  //
  // `meta.code` porte le type d'alerte : on saura non seulement SI ça marche,
  // mais laquelle des quatre déclenche une conversation.
  | "coach_alert_shown"
  | "coach_alert_clicked";

export function track(event: ProductEvent, meta?: Record<string, unknown>): void {
  void trackAsync(event, meta);
}

/**
 * Même chose, mais attendable, pour le seul cas où la SUITE dépend de
 * l'événement : `signup_attributed` atteste côté serveur qu'un inscrit vient
 * bien d'un partenaire donné, et /api/community le relit juste après pour
 * décider du rattachement à sa communauté. En fire-and-forget, l'insertion et
 * la lecture courent l'une contre l'autre et le rattachement se perd.
 *
 * Ne rejette jamais : le tracking ne casse aucun parcours.
 */
export async function trackAsync(event: ProductEvent, meta?: Record<string, unknown>): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("product_events")
      .insert({ user_id: user.id, event, meta: meta ?? null });
    // Colonne/table absente (migration non appliquée) → silencieux.
    if (error && !/product_events/.test(error.message)) {
      console.warn("[track] insert failed:", error.message);
    }
  } catch {
    // Le tracking ne casse JAMAIS un parcours utilisateur.
  }
}
