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
