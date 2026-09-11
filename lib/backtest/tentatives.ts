/**
 * LE COMPTEUR DE REJEUX, QUI DOIT SURVIVRE À LA FERMETURE DE L'ONGLET.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * Le compteur d'essais est le garde-fou le plus important de la page : chercher
 * parmi vingt jeux de paramètres celui qui sort le mieux en trouve TOUJOURS un,
 * même dans du bruit pur, et presque aucun outil de backtest ne l'affiche.
 *
 * ⚠️ IL ÉTAIT DANS UN `useState`. Un rechargement d'onglet le remettait à zéro.
 * Le trader qui travaille sa stratégie sur trois soirées faisait cinquante
 * essais sans jamais voir l'alerte, et l'alerte est le seul moment où l'écran
 * lui dit que son meilleur chiffre est peut-être une coïncidence. Un garde-fou
 * qu'un F5 désarme n'en est pas un.
 *
 * ── LES CHOIX, ET CE QU'ILS COÛTENT ─────────────────────────────────────────
 *
 * **Par stratégie, pas par navigateur.** Deux méthodes différentes sont deux
 * recherches différentes ; les additionner ferait crier au sur-apprentissage
 * quelqu'un qui a simplement deux fiches.
 *
 * ⚠️ **AUCUN BOUTON DE REMISE À ZÉRO**, et c'est délibéré. C'est le seul bouton
 * qui annulerait le garde-fou, et il serait cliqué exactement au moment où il
 * protège le plus : quand le chiffre commence à devenir flatteur.
 *
 * ⚠️ **DANS LE NAVIGATEUR, PAS EN BASE.** Un compteur d'essais n'est pas une
 * donnée de compte : il n'a rien à faire dans une table, il ne se partage pas
 * entre appareils, et il ne mérite ni migration ni requête. La contrepartie est
 * assumée : changer de navigateur repart de zéro. C'est un garde-fou honnête
 * pour quelqu'un de bonne foi, pas une serrure.
 */

const PREFIXE = "backtest:tentatives:";

export interface Tentatives {
  /** Nombre de rejeux lancés sur cette stratégie. */
  n: number;
  /** Date du premier, en ISO. Sert à écrire « depuis le … ». */
  depuis: string;
}

/**
 * Lit sans jamais lever.
 *
 * ⚠️ `localStorage` ÉCHOUE POUR DE VRAI : navigation privée, stockage refusé,
 * quota plein. Une exception non attrapée ici viderait la page entière alors
 * qu'il s'agit d'un compteur d'inconfort. On dégrade vers zéro, et la page
 * fonctionne.
 */
export function lireTentatives(strategieId: string): Tentatives {
  const vide: Tentatives = { n: 0, depuis: new Date().toISOString() };
  if (!strategieId || typeof window === "undefined") return vide;
  try {
    const brut = window.localStorage.getItem(PREFIXE + strategieId);
    if (!brut) return vide;
    const lu = JSON.parse(brut) as Partial<Tentatives>;
    // ⚠️ On ne fait pas confiance à ce qu'on relit : c'est du texte modifiable à
    // la main, et un `n` corrompu affichant « essai n° NaN » serait pire qu'un
    // compteur remis à zéro.
    const n = typeof lu.n === "number" && Number.isFinite(lu.n) && lu.n >= 0 ? Math.floor(lu.n) : 0;
    const depuis = typeof lu.depuis === "string" && lu.depuis ? lu.depuis : vide.depuis;
    return { n, depuis };
  } catch {
    return vide;
  }
}

/**
 * Remonte le compteur au plus grand numéro d'essai déjà archivé.
 *
 * ⚠️⚠️ VU À L'ÉCRAN, ET C'EST L'ARCHIVE ELLE-MÊME QUI DÉNONÇAIT LE COMPTEUR.
 * La carte des garde-fous affichait « 1 essai sur cette stratégie, sous le
 * seuil de 20 · Établi », et trois cartes plus bas la liste des versions
 * enregistrées disait « Enregistrée à l'essai n° 6 » pour la MÊME stratégie.
 * Le stockage local avait été perdu entre les deux (changement de navigateur,
 * navigation privée, données de site effacées, ou simplement un autre poste),
 * et le garde-fou le plus important de la page repartait de zéro sans le dire.
 *
 * ⚠️ ON NE FAIT QUE MONTER, JAMAIS DESCENDRE. Une archive prouve qu'un essai a
 * eu lieu ; elle ne prouve jamais qu'il n'y en a pas eu d'autres, puisqu'on
 * n'enregistre pas tous les rejeux. Le compteur local reste donc la référence
 * quand il est déjà plus haut.
 *
 * ⚠️ LA DATE SUIT LE COMPTEUR. Dire « 6 essais depuis aujourd'hui » quand cinq
 * d'entre eux datent de la semaine dernière serait une deuxième contrevérité.
 */
export function recalerSurLArchive(strategieId: string, archives: number[]): Tentatives {
  const actuel = lireTentatives(strategieId);
  const plancher = archives.reduce(
    (max, n) => (typeof n === "number" && Number.isFinite(n) && n > max ? Math.floor(n) : max),
    0,
  );
  if (plancher <= actuel.n) return actuel;
  const suivant: Tentatives = { n: plancher, depuis: actuel.depuis };
  if (!strategieId || typeof window === "undefined") return suivant;
  try {
    window.localStorage.setItem(PREFIXE + strategieId, JSON.stringify(suivant));
  } catch {
    // Voir compterUnEssai : une écriture refusée laisse la session en cours
    // juste, et le trader n'y peut rien.
  }
  return suivant;
}

/** Enregistre un essai de plus et rend le nouvel état. */
export function compterUnEssai(strategieId: string): Tentatives {
  const actuel = lireTentatives(strategieId);
  const suivant: Tentatives = { n: actuel.n + 1, depuis: actuel.depuis };
  if (!strategieId || typeof window === "undefined") return suivant;
  try {
    window.localStorage.setItem(PREFIXE + strategieId, JSON.stringify(suivant));
  } catch {
    // Écriture refusée : le compteur ne survivra pas au rechargement, mais la
    // session en cours reste juste. Rien à dire au trader, il n'y peut rien.
  }
  return suivant;
}
