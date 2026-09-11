import { fetchAllRows } from "@/lib/supabase-paginate";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * TOUS LES TRADES D'UN COMPTE, DANS L'ORDRE, SANS EN PERDRE EN SILENCE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ TROIS ENDROITS RECONSTITUAIENT LE SOLDE D'UN COMPTE À PARTIR D'UNE
 * LECTURE NON BORNÉE : le garde de compte (celui qui dit « arrête-toi »), le
 * calculateur de position (celui qui dit combien risquer), et la page Comptes,
 * qui ÉCRIT ce solde en base. PostgREST en rend mille au maximum, avec un
 * statut 200 et aucun signal (voir lib/supabase-paginate.ts).
 *
 * Au-delà de mille trades, les trois affichaient donc un solde faux, une courbe
 * d'équité tronquée et un drawdown sous-estimé, chacun de son côté, et le
 * troisième persistait l'erreur. Le commentaire du garde disait déjà se méfier
 * de « deux chiffres différents, dont celui qui déclenche l'alerte d'arrêt » :
 * la troncature les rendait tous les trois faux ensemble, ce qui est pire, parce
 * qu'alors plus rien ne se contredit.
 *
 * ── L'ORDRE ─────────────────────────────────────────────────────────────────
 *
 * ⚠️ ON PAGINE SUR `id` ET ON RETRIE ENSUITE. Paginer sur `open_time`, qui a des
 * doublons (deux trades à la même seconde, c'est courant), fait sauter ou
 * répéter des lignes entre deux pages. La courbe d'équité, elle, veut bien
 * l'ordre chronologique : il se refait en mémoire.
 */
export interface TradeDuCompte {
  pnl: number | null;
  commission: number | null;
  swap: number | null;
  open_time?: string | null;
  status?: string | null;
}

/**
 * @returns la liste complète triée par date d'ouverture, ou `null` si une page
 * a échoué. ⚠️ `null` N'EST PAS UNE LISTE VIDE : un appelant qui somme, trace
 * une courbe ou écrit un solde doit s'arrêter plutôt que d'afficher un chiffre
 * qu'il sait incomplet.
 */
export async function lireTousLesTradesDuCompte<T extends TradeDuCompte>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  challengeId: string,
  colonnes: string,
): Promise<T[] | null> {
  const lignes = await fetchAllRows<T>(
    (from, to) =>
      supabase
        .from("trades")
        .select(colonnes)
        .eq("user_id", userId)
        .eq("challenge_id", challengeId)
        .order("id", { ascending: true })
        // ⚠️ Les colonnes arrivent en chaîne : le typage de Supabase ne peut
        // pas les deviner, l'appelant les déclare par `T`.
        .range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: unknown }>,
  );
  if (!lignes) return null;
  return trierParOuverture(lignes);
}

/** Remet l'ordre chronologique que la pagination ne peut pas garantir. */
export function trierParOuverture<T extends { open_time?: string | null }>(lignes: T[]): T[] {
  return [...lignes].sort((a, b) => (a.open_time ?? "").localeCompare(b.open_time ?? ""));
}

/** Le P&L net d'un trade : brut, commission et swap comptent ensemble. */
export function netDuTrade(t: TradeDuCompte): number {
  return (t.pnl || 0) + (t.commission || 0) + (t.swap || 0);
}
