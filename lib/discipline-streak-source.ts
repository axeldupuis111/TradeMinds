import { computeDisciplineStreaks, type StreakResult } from "@/lib/discipline-streak";
import { fetchAllRows } from "@/lib/supabase-paginate";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * LA SÉRIE DE DISCIPLINE, CALCULÉE UNE SEULE FOIS POUR TOUT LE PRODUIT.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE TABLEAU DE BORD ANNONÇAIT « 75 jours de discipline » ET
 * « STREAK DISCIPLINE 0 », EN MÊME TEMPS, À TRENTE CENTIMÈTRES L'UN DE L'AUTRE.
 * Deux cartes, deux calculs écrits séparément :
 *
 *   - « Objectifs & Discipline » comptait les JOURS DE TRADING sans trade
 *     émotionnel (revenge/FOMO), gels compris, sur tout l'historique ;
 *   - « État du jour » comptait les BILANS DE SÉANCE sans violation, sur les
 *     trente derniers, et s'arrêtait au premier bilan fautif.
 *
 * Rien ne dit au trader que ces deux chiffres ne mesurent pas la même chose :
 * ils portent le même nom. Et c'est le chiffre dont le produit tire son nom.
 *
 * ⚠️ LA DÉFINITION RETENUE EST CELLE DES TRADES, pas celle des bilans : c'est
 * elle que les badges, les gels et les paliers utilisent déjà, et un trader qui
 * n'écrit pas de bilan a quand même une série. La version « bilans » comptait
 * en réalité tout autre chose : la régularité de la relecture.
 *
 * ⚠️ LA LECTURE EST PAGINÉE, ET CE N'EST PAS UN DÉTAIL : non bornée, elle
 * s'arrête à mille trades en silence (voir supabase-paginate.ts) et la série
 * affichée devient fausse sans le dire.
 */
export interface SerieDeDiscipline extends StreakResult {
  /** Faux quand une page de lecture a échoué : le chiffre n'est alors pas sûr. */
  complet: boolean;
}

const VIDE: SerieDeDiscipline = { current: 0, record: 0, isRecord: false, complet: false };

/** Un trade compte contre la série s'il a été pris sous l'émotion. */
function estEmotionnel(emotion: string | null): boolean {
  return emotion === "revenge" || emotion === "fomo";
}

/** Ce qu'il faut savoir d'un trade pour la série, et rien de plus. */
export interface TradePourLaSerie {
  emotion: string | null;
  open_time: string | null;
}

/**
 * La série à partir de trades DÉJÀ LUS.
 *
 * ⚠️ SÉPARÉE DE LA LECTURE pour que « Objectifs & Discipline », qui a déjà les
 * trades en main pour d'autres calculs, s'en serve sans les relire. C'est ce
 * qui garantit qu'il n'existe qu'un seul calcul : celui-ci.
 */
export function serieDepuisLesTrades(
  trades: TradePourLaSerie[],
  joursGeles: Iterable<string>,
): StreakResult {
  const jourEmotionnel = joursEmotionnels(trades);
  // Un jour gelé compte comme propre : le gel sert exactement à ça.
  const geles = new Set<string>(joursGeles);
  return computeDisciplineStreaks(
    Array.from(jourEmotionnel.entries()).map(([day, emotional]) => ({
      day,
      emotional: geles.has(day) ? false : emotional,
    })),
  );
}

/**
 * Pour chaque jour de trading : a-t-il porté un trade émotionnel ?
 *
 * ⚠️ EXPOSÉ PARCE QUE LE GEL S'EN SERT AUSSI : le jour proposé au gel est le
 * plus récent jour fautif, et il doit être décidé par la même lecture que la
 * série qu'il répare.
 */
export function joursEmotionnels(trades: TradePourLaSerie[]): Map<string, boolean> {
  const parJour = new Map<string, boolean>();
  for (const t of trades) {
    if (!t.open_time) continue;
    const jour = t.open_time.split("T")[0];
    parJour.set(jour, (parJour.get(jour) ?? false) || estEmotionnel(t.emotion));
  }
  return parJour;
}

/**
 * @param supabase client déjà authentifié
 * @param userId l'utilisateur dont on compte la série
 */
export async function chargerLaSerieDeDiscipline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<SerieDeDiscipline> {
  const [trades, gels] = await Promise.all([
    fetchAllRows<{ emotion: string | null; open_time: string }>((from, to) =>
      supabase
        .from("trades")
        .select("emotion, open_time")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    // ⚠️ Table absente (migration non appliquée) : aucun gel, pas d'exception.
    supabase.from("streak_freezes").select("day").eq("user_id", userId),
  ]);

  if (!trades) return VIDE;

  const geles = ((gels.data as { day: string }[] | null) || []).map((g) => g.day);
  return { ...serieDepuisLesTrades(trades, geles), complet: true };
}
