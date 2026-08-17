import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateFor } from "@/lib/partners";

/**
 * RELEVÉ MENSUEL PAR RÉSEAU, lu en base (commission_events).
 *
 * Différence avec /api/admin/affiliation, qui reste en place : celui-là
 * interroge Stripe et balaie TOUS les abonnements en mémoire à chaque
 * affichage. C'est tenable à quelques dizaines d'abonnés, pas à plusieurs
 * milliers de codes. Ici, chaque encaissement a déjà été écrit par le webhook :
 * le relevé n'est plus qu'une agrégation.
 *
 * Ce que l'écran doit rendre évident : ce qu'on doit à la SOCIÉTÉ (une facture,
 * un virement), et le détail collaborateur par collaborateur qui lui permet de
 * faire SON découpage sans nous le demander. On ne calcule volontairement aucune
 * commission par collaborateur : ce partage-là est interne au réseau, et il
 * n'est pas de notre ressort.
 */

interface RepReport {
  code: string;
  name: string;
  signups: number;
  subscribers: number;
  gross: number;
  eligible: number;
}

interface PartnerReport {
  id: string;
  name: string;
  kind: string;
  signups: number;
  subscribers: number;
  gross: number;
  eligible: number;
  rate: number;
  tier: string;
  commission: number;
  reps: RepReport[];
}

export async function GET(req: NextRequest) {
  // ── Garde admin, identique à /api/admin/affiliation ───────────────────────
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

  const monthParam = req.nextUrl.searchParams.get("month") ?? "";
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) : now.getUTCMonth() + 1;
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "Mois invalide" }, { status: 400 });
  }
  const windowStart = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const windowEnd = new Date(Date.UTC(year, month, 1)).toISOString();

  try {
    const supabase = createAdminClient();

    const [{ data: partners }, { data: reps }] = await Promise.all([
      supabase.from("partners").select("id, name, kind, flat_rate").order("name"),
      supabase.from("partner_reps").select("id, code, display_name, partner_id"),
    ]);

    if (!partners || partners.length === 0) {
      return NextResponse.json({ month: monthParam, partners: [], totals: { gross: 0, eligible: 0, commission: 0 } });
    }

    // Abonnés payants : quelques dizaines de lignes, contre potentiellement des
    // milliers d'attributions. On part donc des PAYANTS et on croise, plutôt que
    // d'interroger le plan de chaque filleul.
    const { data: payers } = await supabase
      .from("profiles")
      .select("id")
      .in("plan", ["plus", "premium"]);
    const payingIds = new Set((payers ?? []).map((p) => p.id as string));

    const { data: attributions } = await supabase
      .from("referral_attributions")
      .select("user_id, partner_id, rep_id");

    const { data: events } = await supabase
      .from("commission_events")
      .select("partner_id, rep_id, amount_cents, eligible")
      .gte("occurred_at", windowStart)
      .lt("occurred_at", windowEnd);

    // ── Agrégation ────────────────────────────────────────────────────────────
    const repById = new Map((reps ?? []).map((r) => [r.id as string, r]));
    const reports = new Map<string, PartnerReport>();
    const repReports = new Map<string, RepReport>();

    for (const p of partners) {
      reports.set(p.id as string, {
        id: p.id as string,
        name: p.name as string,
        kind: p.kind as string,
        signups: 0, subscribers: 0, gross: 0, eligible: 0,
        rate: 0, tier: "", commission: 0,
        reps: [],
      });
    }

    const ensureRep = (repId: string): RepReport | null => {
      let r = repReports.get(repId);
      if (r) return r;
      const row = repById.get(repId);
      if (!row) return null;
      r = {
        code: row.code as string,
        name: row.display_name as string,
        signups: 0, subscribers: 0, gross: 0, eligible: 0,
      };
      repReports.set(repId, r);
      reports.get(row.partner_id as string)?.reps.push(r);
      return r;
    };

    // Volumes (indépendants du mois affiché : c'est l'état du portefeuille).
    for (const a of attributions ?? []) {
      const partnerReport = a.partner_id ? reports.get(a.partner_id as string) : null;
      const repReport = a.rep_id ? ensureRep(a.rep_id as string) : null;
      const isPaying = payingIds.has(a.user_id as string);

      if (partnerReport) {
        partnerReport.signups += 1;
        if (isPaying) partnerReport.subscribers += 1;
      }
      if (repReport) {
        repReport.signups += 1;
        if (isPaying) repReport.subscribers += 1;
      }
    }

    // Encaissements du mois. Les reprises sont déjà négatives en base : elles
    // se soustraient d'elles-mêmes, sans traitement particulier.
    for (const e of events ?? []) {
      const amount = e.amount_cents as number;
      const partnerReport = e.partner_id ? reports.get(e.partner_id as string) : null;
      const repReport = e.rep_id ? ensureRep(e.rep_id as string) : null;

      if (partnerReport) {
        partnerReport.gross += amount;
        if (e.eligible) partnerReport.eligible += amount;
      }
      if (repReport) {
        repReport.gross += amount;
        if (e.eligible) repReport.eligible += amount;
      }
    }

    const flatById = new Map(partners.map((p) => [p.id as string, p.flat_rate as number | null]));
    const result = Array.from(reports.values())
      .map((r) => {
        // Chaque partenaire est jugé sur SON échelle : celle de son contrat pour
        // un influenceur, celle des réseaux pour une société à collaborateurs.
        const { rate, tier } = rateFor(
          r.subscribers,
          flatById.get(r.id),
          r.kind === "network" ? "network" : "influencer"
        );
        return {
          ...r,
          rate,
          tier,
          commission: Math.round(r.eligible * rate),
          reps: r.reps.sort((a, b) => b.gross - a.gross || b.subscribers - a.subscribers),
        };
      })
      // Un partenaire sans aucune inscription ni encaissement n'a rien à dire.
      .filter((r) => r.signups > 0 || r.gross !== 0)
      .sort((a, b) => b.commission - a.commission || b.gross - a.gross);

    return NextResponse.json({
      month: `${year}-${String(month).padStart(2, "0")}`,
      partners: result,
      totals: {
        gross: result.reduce((s, r) => s + r.gross, 0),
        eligible: result.reduce((s, r) => s + r.eligible, 0),
        commission: result.reduce((s, r) => s + r.commission, 0),
      },
    });
  } catch (err) {
    console.error("[Admin Partners] erreur:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
