import {
  addDaysToDateKey as decalerJours,
  localDateKey,
  startOfDateKeyUtc,
  weekStartLocalKey,
} from "@/lib/timezone";

/**
 * LA CLÉ DE PÉRIODE D'UN OBJECTIF RÉCURRENT. Une seule définition.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ TROIS IMPLÉMENTATIONS DE LA MÊME CLÉ, dans trois fichiers, avec trois
 * conventions différentes :
 *
 *   • `app/dashboard/goals/page.tsx` posait minuit LOCAL puis écrivait la date
 *     UTC de cet instant (`setHours(0,0,0,0)` puis `toISOString()`). Pour tout
 *     trader à l'est de Greenwich, minuit local tombe la VEILLE en UTC : la clé
 *     était donc décalée d'un jour, TOUS LES JOURS, pas seulement aux bords.
 *   • `lib/coach-tools.ts` posait minuit local puis lisait la date LOCALE : sur
 *     un serveur Vercel, « local » veut dire UTC.
 *   • `app/api/goals/route.ts` dérivait la clé d'un `toISOString()`, donc UTC.
 *
 * ⚠️ CE QUE ÇA COÛTAIT AU TRADER : la reconduction compare la clé stockée à la
 * clé recalculée, et les deux ne venaient pas du même endroit. Un objectif
 * récurrent créé depuis le navigateur portait une clé que le serveur ne
 * reconnaissait pas, donc il était reconduit immédiatement : coché remis à
 * zéro, série remise à zéro. Le trader voyait sa série disparaître sans avoir
 * rien manqué.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une période appartient au calendrier du TRADER. La clé est la date de début
 * de période dans son fuseau, et elle s'obtient ici, nulle part ailleurs.
 */

export type PeriodeObjectif = "day" | "week" | "month" | "quarter" | "year";

/** La date de début de la période courante, dans le fuseau du trader. */
export function cleDePeriode(
  periode: PeriodeObjectif,
  fuseau?: string | null,
  maintenant: Date = new Date(),
): string {
  const jour = localDateKey(fuseau, maintenant); // "YYYY-MM-DD" chez le trader
  const [annee, mois] = jour.split("-").map(Number);

  if (periode === "day") return jour;
  if (periode === "week") return weekStartLocalKey(fuseau, maintenant);
  if (periode === "year") return `${annee}-01-01`;
  if (periode === "quarter") {
    const premierDuTrimestre = mois - ((mois - 1) % 3);
    return `${annee}-${String(premierDuTrimestre).padStart(2, "0")}-01`;
  }
  return `${annee}-${String(mois).padStart(2, "0")}-01`;
}

/**
 * L'instant où la période courante a commencé, pour borner une requête sur une
 * colonne `timestamptz`.
 *
 * ⚠️ Une clé est une DATE, une borne est un INSTANT : les confondre revient à
 * comparer la date du trader à minuit UTC, c'est-à-dire à refaire le défaut.
 */
export function debutDePeriodeIso(
  periode: PeriodeObjectif,
  fuseau?: string | null,
  maintenant: Date = new Date(),
): string {
  const cle = cleDePeriode(periode, fuseau, maintenant);
  return (startOfDateKeyUtc(cle, fuseau) ?? new Date(0)).toISOString();
}

/**
 * Les bornes [debut, fin) de la periode decalee de `offset` periodes vers le
 * passe (0 = la periode courante), dans le fuseau du trader.
 *
 * ⚠️ TOUT LE CALCUL SE FAIT SUR DES CLES DE DATE, jamais sur une horloge :
 * decaler un mois avec `setMonth` sur un `Date` traverse les changements
 * d'heure et decale la borne d'une heure, ce qui suffit a faire basculer un
 * trade du mauvais cote. On decale la date, puis on demande l'instant.
 */
export function bornesDePeriode(
  periode: PeriodeObjectif,
  offset: number,
  fuseau?: string | null,
  maintenant: Date = new Date(),
): { start: Date; end: Date } {
  const courante = cleDePeriode(periode, fuseau, maintenant);
  const [annee, mois] = courante.split("-").map(Number);

  function instant(cle: string): Date {
    return startOfDateKeyUtc(cle, fuseau) ?? new Date(0);
  }
  function parMois(delta: number, pas: number): { debut: string; fin: string } {
    const base = (annee * 12 + (mois - 1)) + delta;
    const f = (n: number) =>
      `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}-01`;
    return { debut: f(base), fin: f(base + pas) };
  }

  if (periode === "day") {
    const debut = decalerJours(courante, -offset);
    return { start: instant(debut), end: instant(decalerJours(debut, 1)) };
  }
  if (periode === "week") {
    const debut = decalerJours(courante, -offset * 7);
    return { start: instant(debut), end: instant(decalerJours(debut, 7)) };
  }
  if (periode === "quarter") {
    const { debut, fin } = parMois(-offset * 3, 3);
    return { start: instant(debut), end: instant(fin) };
  }
  if (periode === "year") {
    return { start: instant(`${annee - offset}-01-01`), end: instant(`${annee - offset + 1}-01-01`) };
  }
  const { debut, fin } = parMois(-offset, 1);
  return { start: instant(debut), end: instant(fin) };
}

/**
 * La clé de la période qui précède immédiatement `cle`.
 *
 * ⚠️ Pur calcul sur des clés de date, comme `bornesDePeriode` : pas d'horloge,
 * donc pas de changement d'heure qui décale la borne.
 */
export function clePrecedente(periode: PeriodeObjectif, cle: string): string {
  const [annee, mois] = cle.split("-").map(Number);
  if (periode === "day") return decalerJours(cle, -1);
  if (periode === "week") return decalerJours(cle, -7);
  if (periode === "year") return `${annee - 1}-01-01`;
  const pas = periode === "quarter" ? 3 : 1;
  const base = annee * 12 + (mois - 1) - pas;
  return `${Math.floor(base / 12)}-${String((base % 12) + 1).padStart(2, "0")}-01`;
}

/** Au-delà, on ne compte plus : la série est cassée depuis longtemps. */
export const PERIODES_REMONTEES_MAX = 520;

/**
 * COMBIEN DE PÉRIODES SE SONT ÉCOULÉES ENTRE DEUX CLÉS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────
 *
 * ⚠️⚠️ LA RECONDUCTION D'UN OBJECTIF RÉCURRENT NE COMPTAIT PAS LES PÉRIODES
 * SAUTÉES. Elle comparait la clé stockée à la clé du jour et, si elles
 * différaient, ajoutait UN à la série. Un objectif hebdomadaire coché une fois
 * puis laissé cinq semaines rendait donc une série de deux : quatre semaines
 * jamais tenues, effacées en silence.
 *
 * ⚠️ ET LA RECONDUCTION NE TOURNE QU'À LA VISITE de la page : la série
 * dépendait donc de la fréquence des visites, pas de la discipline. C'est
 * exactement ce que le produit vend le contraire de.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : six objectifs perso récurrents portent
 * encore la clé `2026-09-07` (la semaine passée) ou `2026-09-09`, sans que
 * personne ne les ait rouverts depuis.
 *
 * Rend le nombre de périodes, borné à `PERIODES_REMONTEES_MAX`. Rend 0 si les
 * clés sont identiques, et le maximum si la clé stockée est introuvable
 * (illisible, ou dans le futur) : dans le doute, la chaîne est rompue.
 */
export function periodesEcoulees(
  periode: PeriodeObjectif,
  depuis: string | null | undefined,
  jusqu: string,
  max: number = PERIODES_REMONTEES_MAX,
): number {
  if (!depuis) return max;
  if (depuis === jusqu) return 0;
  let cle = jusqu;
  for (let n = 1; n <= max; n++) {
    cle = clePrecedente(periode, cle);
    if (cle === depuis) return n;
    if (cle < depuis) return max; // la clé stockée n'est pas sur la grille
  }
  return max;
}

/**
 * CE QUE DEVIENT LA SÉRIE D'UN OBJECTIF RÉCURRENT QUAND LA PÉRIODE CHANGE.
 *
 * ⚠️⚠️ LES PÉRIODES SAUTÉES NE SE COMPTAIENT PAS : la reconduction ajoutait UN
 * dès que la clé avait changé, quelle que soit la durée du silence. Un objectif
 * hebdomadaire coché une fois puis laissé cinq semaines rendait une série de
 * deux. Une série qui survit aux trous n'est pas une série.
 *
 * ⚠️ LE RECORD GARDE CE QUI A ÉTÉ TENU : la période cochée compte dans le
 * record même quand la chaîne se casse juste après. Le casser aussi punirait
 * deux fois le même oubli.
 */
export function reconduireLaSerie(etat: {
  done: boolean;
  serie: number;
  record: number;
  ecoulees: number;
}): { serie: number; record: number } {
  const chaine = etat.done ? etat.serie + 1 : 0;
  return {
    serie: etat.ecoulees === 1 ? chaine : 0,
    record: Math.max(etat.record, chaine),
  };
}
