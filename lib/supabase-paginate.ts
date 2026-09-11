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

/**
 * Lit toutes les lignes correspondant à une LISTE D'IDENTIFIANTS.
 *
 * ── LES DEUX PLAFONDS, ET POURQUOI ILS VONT ENSEMBLE ────────────────────────
 *
 * ⚠️⚠️ `chunk` EXISTAIT, ET NE SERVAIT QU'AUX ÉCRITURES. Son commentaire le dit
 * lui-même (« sert aux écritures par identifiants ») : les suppressions en lot
 * de trades découpaient bien leur liste, et AUCUNE lecture ne le faisait. Or une
 * lecture `?id=in.(…)` voyage dans la même URL, avec la même limite de taille.
 *
 * ⚠️ ET LES DEUX PLAFONDS SE CUMULENT, chacun avec sa panne :
 *
 *   - trop d'identifiants dans l'URL → la requête échoue D'UN BLOC (414) ;
 *   - trop de lignes en réponse → elle réussit, tronquée à mille, EN SILENCE.
 *
 * Corriger l'un sans l'autre déplace la panne au lieu de la réparer : c'est
 * pourquoi cette fonction découpe la liste ET pagine chaque tranche.
 *
 * ⚠️ ORDRE DÉTERMINISTE OBLIGATOIRE dans `build`, pour la même raison que
 * `fetchAllRows` : un tri à doublons fait sauter ou répéter des lignes.
 *
 * Rend `null` si une seule tranche échoue, jamais une liste partielle.
 */
export async function fetchAllByIds<T>(
  ids: readonly string[],
  build: (lot: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  if (ids.length === 0) return [];
  const all: T[] = [];
  for (const lot of chunk([...ids], ID_CHUNK)) {
    const page = await fetchAllRows<T>((from, to) => build(lot, from, to));
    if (page === null) return null;
    all.push(...page);
  }
  return all;
}
