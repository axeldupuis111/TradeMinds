import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { tierFor } from "@/lib/partners";

/**
 * Affiliation (admin) — commissions influenceur calculées depuis Stripe.
 *
 * Attribution d'un abonnement à un code promo, dans l'ordre :
 *   1. subscription.metadata.promo_code — gravé par le webhook au checkout,
 *      persiste après l'expiration de la remise (source principale) ;
 *   2. remise encore attachée à la subscription (fallback pour les abonnements
 *      antérieurs à la mise en place du webhook).
 *
 * Pour le mois demandé (?month=YYYY-MM, défaut mois courant, bornes UTC) :
 * factures payées des abonnements attribués → encaissé brut, assiette limitée
 * aux 12 premiers mois de chaque abonnement (contrat influenceur).
 *
 * Barème progressif (contrat, Annexe 1) : le taux dépend du nombre d'abonnés
 * actifs rapportés — Bronze 20 % (1-10), Argent 25 % (11-40), Or 30 % (41+) —
 * et le taux du palier atteint s'applique à l'ENSEMBLE de l'assiette du mois.
 * Montants en centimes — le front formate.
 *
 * Même garde admin que /api/admin/funnel (ADMIN_EMAILS).
 */

// Barème importé de lib/partners : une seule définition pour les deux relevés
// (celui-ci, historique et lu chez Stripe, et /api/admin/partners, lu en base).
// Deux copies du barème, c'est deux montants différents pour le même mois.

interface CodeReport {
  code: string;
  /** Abonnements attribués au code, tous statuts confondus. */
  subscriptions: number;
  /** Abonnements encore actifs (active / trialing / past_due). */
  activeSubscriptions: number;
  /** Encaissé sur le mois (centimes), toutes factures payées. */
  gross: number;
  /** Part de l'encaissé dans les 12 premiers mois des abonnements (centimes). */
  eligible: number;
  /** Taux du palier atteint (0.2 / 0.25 / 0.3) et son nom. */
  rate: number;
  tier: string;
  /** Commission due (centimes). */
  commission: number;
}

/** L'id de subscription d'une facture a bougé selon les versions d'API
 *  (invoice.subscription → invoice.parent.subscription_details) — on tolère
 *  les deux formes. */
function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const legacy = (inv as unknown as { subscription?: string | { id: string } | null }).subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object") return legacy.id;
  const parent = (inv as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  }).parent;
  const nested = parent?.subscription_details?.subscription;
  if (typeof nested === "string") return nested;
  if (nested && typeof nested === "object") return nested.id;
  return null;
}

export async function GET(req: NextRequest) {
  // ── Garde admin (cookie session + liste blanche ADMIN_EMAILS) ────────────
  const cookieStore = cookies();
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // ── Fenêtre du mois demandé ───────────────────────────────────────────────
  const monthParam = req.nextUrl.searchParams.get("month") ?? "";
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) : now.getUTCMonth() + 1;
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "Mois invalide" }, { status: 400 });
  }
  const windowStart = Date.UTC(year, month - 1, 1) / 1000;
  const windowEnd = Date.UTC(year, month, 1) / 1000;

  try {
    // ── 0. Codes appartenant à un RÉSEAU : à exclure d'ici ────────────────
    // Un collaborateur de réseau grave lui aussi son code dans
    // `subscription.metadata.promo_code`. Sans ce filtre, ses ventes
    // apparaîtraient DEUX fois : ici, code par code et au palier Bronze (un
    // collaborateur dépasse rarement 10 abonnés à lui seul), et dans l'onglet
    // Réseaux, agrégées au palier du réseau. Deux écrans, deux montants, pour
    // le même argent : c'est exactement le genre d'écart qui fait perdre un
    // mois à comprendre qui a raison.
    const excluded = new Set<string>();
    try {
      const admin = createAdminClient();
      const { data: networkReps } = await admin
        .from("partner_reps")
        .select("code, partners!inner(kind)")
        .eq("partners.kind", "network");
      for (const r of networkReps ?? []) excluded.add(String(r.code).toUpperCase());
    } catch (err) {
      // Base injoignable : on préfère un relevé complet (avec les réseaux
      // dedans) à pas de relevé du tout, mais on le dit fort.
      console.error("[Admin Affiliation] exclusion des réseaux impossible:", err);
    }

    // ── 1. Abonnements attribués à un code promo ──────────────────────────
    // Volume faible (petit SaaS) : on liste tout et on filtre en mémoire.
    const attributed = new Map<string, { code: string; startDate: number; status: string }>();
    const promoCodeCache = new Map<string, string>(); // promo id → code lisible

    const allSubs = await stripe.subscriptions
      .list({ status: "all", limit: 100, expand: ["data.discounts"] })
      .autoPagingToArray({ limit: 10000 });

    for (const sub of allSubs) {
      let code: string | null = sub.metadata?.promo_code || null;

      if (!code) {
        // Fallback : remise encore attachée (abonnements pré-webhook).
        for (const d of sub.discounts ?? []) {
          if (typeof d === "string") continue;
          const promoRef = d.promotion_code;
          if (!promoRef) continue;
          if (typeof promoRef !== "string") { code = promoRef.code; break; }
          let cached = promoCodeCache.get(promoRef);
          if (!cached) {
            cached = (await stripe.promotionCodes.retrieve(promoRef)).code;
            promoCodeCache.set(promoRef, cached);
          }
          code = cached;
          break;
        }
      }

      if (code && !excluded.has(code.toUpperCase())) {
        attributed.set(sub.id, {
          code: code.toUpperCase(),
          startDate: sub.start_date,
          status: sub.status,
        });
      }
    }

    // ── 2. Factures payées du mois → agrégation par code ──────────────────
    const reports = new Map<string, CodeReport>();
    const ensure = (code: string): CodeReport => {
      let r = reports.get(code);
      if (!r) {
        r = { code, subscriptions: 0, activeSubscriptions: 0, gross: 0, eligible: 0, rate: 0, tier: "", commission: 0 };
        reports.set(code, r);
      }
      return r;
    };

    // Compteurs d'abonnements (indépendants du mois affiché).
    for (const { code, status } of Array.from(attributed.values())) {
      const r = ensure(code);
      r.subscriptions += 1;
      if (status === "active" || status === "trialing" || status === "past_due") {
        r.activeSubscriptions += 1;
      }
    }

    if (attributed.size > 0) {
      const monthInvoices = await stripe.invoices
        .list({ status: "paid", created: { gte: windowStart, lt: windowEnd }, limit: 100 })
        .autoPagingToArray({ limit: 10000 });

      for (const inv of monthInvoices) {
        const subId = invoiceSubscriptionId(inv);
        if (!subId) continue;
        const attr = attributed.get(subId);
        if (!attr || inv.amount_paid <= 0) continue;

        const r = ensure(attr.code);
        r.gross += inv.amount_paid;

        // Assiette contractuelle : 12 premiers mois de l'abonnement.
        const limit = new Date(attr.startDate * 1000);
        limit.setUTCFullYear(limit.getUTCFullYear() + 1);
        if (inv.created * 1000 < limit.getTime()) {
          r.eligible += inv.amount_paid;
        }
      }
    }

    const codes = Array.from(reports.values())
      .map((r) => {
        const tier = tierFor(r.activeSubscriptions);
        return { ...r, rate: tier.rate, tier: tier.name, commission: Math.round(r.eligible * tier.rate) };
      })
      .sort((a, b) => b.commission - a.commission || b.gross - a.gross);

    return NextResponse.json({
      month: `${year}-${String(month).padStart(2, "0")}`,
      codes,
      totals: {
        gross: codes.reduce((s, c) => s + c.gross, 0),
        eligible: codes.reduce((s, c) => s + c.eligible, 0),
        commission: codes.reduce((s, c) => s + c.commission, 0),
      },
    });
  } catch (err) {
    console.error("[Admin Affiliation] Stripe error:", err);
    return NextResponse.json({ error: "Erreur Stripe" }, { status: 502 });
  }
}
