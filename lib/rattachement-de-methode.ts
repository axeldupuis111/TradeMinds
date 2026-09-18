import type { SupabaseClient } from "@supabase/supabase-js";
import { chunk, ID_CHUNK } from "@/lib/supabase-paginate";

/**
 * RATTACHER DES TRADES À LA MÉTHODE QUI LES A PRODUITS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `trades.strategy_id` EXISTE ET N'EST QUASI JAMAIS REMPLI. Mesuré en base
 * le 2026-09-18 : ZÉRO trade rattaché sur les 157 d'un abonné premium qui a
 * trois fiches, 74 % chez le deuxième trader multi-fiches. Et quand il l'est,
 * c'est avec la fiche que la page avait sélectionnée d'office — la plus
 * ancienne — pas avec la méthode réellement suivie.
 *
 * ⚠️ CE QUE ÇA COÛTE : aucune règle de fiche n'est attribuable à un trade.
 * Toutes les surfaces qui jugent ont donc dû se rabattre sur l'union des fiches
 * (voir lib/regles-du-trader), c'est-à-dire sur le refus d'accuser. C'est
 * honnête, et c'est grossier : un trader qui respecte sa méthode swing et
 * massacre sa méthode scalping obtient le même verdict que celui qui fait
 * l'inverse.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le rattachement se fait EN LOT, depuis la liste des trades, sur la sélection
 * que le trader a déjà sous la main. Et le nombre annoncé est celui que la base
 * a réellement touché : une écriture non relue ment (voir la fiche
 * supabase-silent-errors — seize annulations du coach ont répondu « c'est
 * fait » sans rien restaurer).
 */

export interface ResultatDeRattachement {
  /** Trades réellement modifiés, comptés sur ce que la base a rendu. */
  rattaches: number;
  /** Nombre demandé, pour dire « 180 sur 200 » plutôt que « fait ». */
  demandes: number;
  /** Message brut de la base si une tranche a échoué. */
  erreur: string | null;
}

/**
 * Rattache des trades à une fiche, ou les détache si `strategyId` vaut `null`.
 *
 * ⚠️ UNE TRANCHE QUI ÉCHOUE N'ANNULE PAS LES PRÉCÉDENTES : on s'arrête, et on
 * rend le compte exact de ce qui est passé. Annoncer un échec total après avoir
 * modifié cent lignes serait un deuxième mensonge. C'est la même conduite que
 * la suppression en lot, juste à côté.
 *
 * ⚠️ Les tranches viennent de `lib/supabase-paginate` : les identifiants
 * voyagent dans l'URL, une liste trop longue fait échouer la requête d'un bloc.
 */
export async function rattacherLesTrades(
  supabase: SupabaseClient,
  ids: string[],
  strategyId: string | null,
): Promise<ResultatDeRattachement> {
  const demandes = ids.length;
  if (demandes === 0) return { rattaches: 0, demandes: 0, erreur: null };

  let rattaches = 0;
  for (const tranche of chunk(ids, ID_CHUNK)) {
    const { data, error } = await supabase
      .from("trades")
      .update({ strategy_id: strategyId })
      .in("id", tranche)
      .select("id");
    if (error) return { rattaches, demandes, erreur: error.message };
    rattaches += data?.length ?? 0;
  }
  return { rattaches, demandes, erreur: null };
}
