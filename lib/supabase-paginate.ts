// Lecture complète d'une table, malgré le plafond de lignes de PostgREST.
//
// Mesuré sur ce projet le 2026-08-06, avec 1 100 lignes en base : une requête
// sans borne en rend exactement 1 000, statut 200, `content-range: 0-999/*`.
// Aucune erreur, aucun code anormal, aucun signal. C'est ce qui rend le défaut
// dangereux : le code part dans sa branche succès avec des données amputées, et
// affiche des totaux, des courbes ou des exports qui ont l'air complets.
//
// Une lecture non bornée est donc juste tant que l'utilisateur a peu de lignes,
// et devient fausse en silence ensuite. Tout ce qui agrège (somme, moyenne,
// winrate, courbe, export, suppression) doit passer par ici.

/** Ce que PostgREST accepte de rendre en une fois. Voir l'en-tête du fichier. */
export const ROWS_PER_REQUEST = 1000;

/**
 * Lit TOUTES les lignes d'une requête, page par page.
 *
 * Renvoie `null` si une page échoue, jamais une liste partielle : un appelant
 * qui agrège ou supprime doit pouvoir distinguer « voici tout » de « voici ce
 * que j'ai pu avoir ».
 *
 * @param build construit la requête pour une plage donnée. Doit poser un tri
 *              DÉTERMINISTE, c'est-à-dire sur une colonne unique (`id`) : avec
 *              un tri sur une colonne à doublons, deux pages consécutives
 *              peuvent se recouvrir ou sauter des lignes. Si l'affichage
 *              demande un autre ordre, il se refait en mémoire après coup.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  const all: T[] = [];
  for (let from = 0; ; from += ROWS_PER_REQUEST) {
    const { data, error } = await build(from, from + ROWS_PER_REQUEST - 1);
    if (error) return null;
    if (!data) break;
    all.push(...data);
    if (data.length < ROWS_PER_REQUEST) break;
  }
  return all;
}

/**
 * Découpe une liste en tranches d'au plus `size`.
 *
 * Sert aux écritures par identifiants : ceux-ci voyagent dans l'URL
 * (`?id=in.(…)`) et un UUID pèse 37 caractères, donc une liste trop longue
 * dépasse la taille d'URL acceptée et la requête échoue d'un bloc.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Taille de tranche sûre pour une requête portant des identifiants en URL. */
export const ID_CHUNK = 100;
