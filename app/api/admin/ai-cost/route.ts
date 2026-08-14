import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { AI_ROUTES, COACH_DEFAULT, coutCoachEur, coutRouteEur } from "@/lib/product-margin";

/**
 * COÛT IA RÉEL (admin) — ce que le produit dépense vraiment, par route et par
 * modèle, à confronter au modèle économique.
 *
 * POURQUOI. `logAiCost` écrit un événement `ai_call` à chaque appel depuis le
 * 2026-08-06 : modèle, plan, coût en euros, tokens d'entrée, de sortie, de
 * cache. Ces lignes s'accumulaient sans que rien ne les lise. Résultat : tous
 * les arbitrages du 2026-08-14 (passage à Sonnet 5, plafond ramené à 260,
 * catalogue différé) ont été tranchés sur SEPT routes chiffrées par majorant,
 * faute d'avoir regardé ce qu'on mesurait déjà.
 *
 * C'est cette incertitude, et elle seule, qui a coûté 80 messages de plafond :
 * le stress test exige que la marge survive à des majorants 20 % trop bas.
 * Chaque route qui passe de « estimée » à « mesurée » rend du quota au trader.
 *
 * ⚠️ CE QUI EST COMPARÉ. `reel` vient des événements, `modele` du pire cas de
 * `product-margin.ts` (abonné AU PLAFOND). Ils ne sont donc PAS censés être
 * égaux : le réel est une moyenne d'usage, le modèle un majorant. Ce qu'on
 * surveille, c'est le coût par APPEL, seule grandeur comparable entre les deux.
 */

interface LigneCout {
  route: string;
  model: string;
  appels: number;
  coutTotalEur: number;
  /** Coût moyen d'un appel, la seule grandeur comparable au modèle. */
  coutParAppelEur: number;
  /** Ce que `product-margin.ts` prévoit pour un appel de cette route. */
  modeleParAppelEur: number | null;
  /** Origine du chiffre du modèle : mesuré ou majorant assumé. */
  source: string | null;
  tokensEntree: number;
  tokensSortie: number;
  /** Part des entrées servie par le cache : proche de 1 = cache chaud. */
  tauxCache: number | null;
}

/** Coût modélisé d'UN appel, pour la comparaison. */
function modeleParAppel(route: string): { eur: number; source: string } | null {
  if (route === "chat-coach") {
    const messages = COACH_DEFAULT.plafond.premium;
    // Le coach est le seul à porter un cache : son coût par appel n'a de sens
    // que rapporté au nombre d'appels du pire cas, tours d'outils compris.
    const appels = messages * COACH_DEFAULT.roundsParMessage;
    return { eur: coutCoachEur(COACH_DEFAULT, "premium") / appels, source: "modèle coach" };
  }
  const nom = route === "analyze" ? "analyse de trades"
    : route === "analyze-trade-vision" ? "analyse visuelle (vision)"
    : null;
  if (!nom) return null;
  const r = AI_ROUTES.find((x) => x.nom === nom);
  if (!r || !r.plafond.premium) return null;
  return { eur: coutRouteEur(r, "premium") / r.plafond.premium, source: r.source };
}

export async function GET(req: NextRequest) {
  // ── Garde admin (cookie session + liste blanche ADMIN_EMAILS) ────────────
  const cookieStore = cookies();
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } },
  );
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!user.email || !adminEmails.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = daysParam === 7 ? 7 : daysParam === 90 ? 90 : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("product_events")
    .select("user_id, meta, created_at")
    .eq("event", "ai_call")
    .gte("created_at", since)
    .limit(50_000);

  if (error) {
    // La table peut manquer si la migration du funnel n'a pas été appliquée :
    // le dire plutôt que d'afficher un tableau vide qui ressemble à « rien ».
    return NextResponse.json({ eventsTableMissing: true, days, lignes: [], total: 0, abonnes: 0 });
  }

  interface Meta {
    route?: string; model?: string; plan?: string; cost_eur?: number;
    input?: number; output?: number; cache_read?: number; cache_write?: number;
  }
  const agg = new Map<string, LigneCout & { cacheRead: number; cacheTotal: number }>();
  const users = new Set<string>();
  let total = 0;

  for (const row of data ?? []) {
    const m = (row.meta ?? {}) as Meta;
    if (!m.route) continue;
    users.add(row.user_id);
    const cle = `${m.route}|${m.model ?? "?"}`;
    const cur = agg.get(cle) ?? {
      route: m.route, model: m.model ?? "?", appels: 0, coutTotalEur: 0,
      coutParAppelEur: 0, modeleParAppelEur: null, source: null,
      tokensEntree: 0, tokensSortie: 0, tauxCache: null, cacheRead: 0, cacheTotal: 0,
    };
    cur.appels += 1;
    cur.coutTotalEur += m.cost_eur ?? 0;
    cur.tokensEntree += (m.input ?? 0) + (m.cache_read ?? 0) + (m.cache_write ?? 0);
    cur.tokensSortie += m.output ?? 0;
    cur.cacheRead += m.cache_read ?? 0;
    cur.cacheTotal += (m.input ?? 0) + (m.cache_read ?? 0) + (m.cache_write ?? 0);
    agg.set(cle, cur);
    total += m.cost_eur ?? 0;
  }

  const lignes: LigneCout[] = Array.from(agg.values())
    .map(({ cacheRead, cacheTotal, ...l }) => {
      const modele = modeleParAppel(l.route);
      return {
        ...l,
        coutParAppelEur: l.appels ? l.coutTotalEur / l.appels : 0,
        modeleParAppelEur: modele?.eur ?? null,
        source: modele?.source ?? null,
        tauxCache: cacheTotal ? cacheRead / cacheTotal : null,
      };
    })
    .sort((a, b) => b.coutTotalEur - a.coutTotalEur);

  return NextResponse.json({
    days,
    lignes,
    total,
    /** Traders distincts ayant déclenché au moins un appel sur la fenêtre. */
    abonnes: users.size,
    eventsTableMissing: false,
  });
}
