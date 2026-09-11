import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN FAIT, UN CHIFFRE, MÊME QUAND IL VAUT ZÉRO.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE TABLEAU DE BORD ÉCRIVAIT DEUX CHOSES DIFFÉRENTES POUR LE MÊME FAIT,
 * À QUATRE-VINGT-DIX PIXELS D'ÉCART. La carte du score de discipline porte
 * trois mini-mesures, et les deux cartes juste en dessous répètent deux
 * d'entre elles. Sans trade cette semaine, l'écran affichait à la fois
 * « Trades cette semaine — » et « Trades cette semaine 0 », « P&L du jour — »
 * et « P&L du jour +0,00 € ».
 *
 * ⚠️ UN TIRET ET UN ZÉRO NE DISENT PAS LA MÊME CHOSE : le tiret dit « on ne
 * sait pas », le zéro dit « on sait, et il n'y a rien ». Les deux ne peuvent
 * pas être vrais du même fait au même instant.
 *
 * ⚠️⚠️ ET CE COUPLE AVAIT DÉJÀ ÉTÉ RECOLLÉ UNE FOIS : une passe précédente
 * avait corrigé l'espace avant le symbole (« +0,00 € » contre « +0,00€ »)
 * entre ces deux mêmes affichages. La divergence du zéro, elle, avait survécu.
 * C'est la moitié d'une règle, encore.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * ⚠️ IL EST ÉTROIT VOLONTAIREMENT. J'ai d'abord écrit un garde général (« un
 * libellé affiché deux fois dans un fichier doit avoir le même rendu à
 * zéro ») : il accusait la carte du compte actif, dont les trois variantes
 * sont les branches d'un `if/else` et ne peuvent donc jamais être à l'écran
 * ensemble. Un garde qui ne sait pas distinguer deux affichages simultanés de
 * deux branches exclusives accuse à tort, et un garde qui accuse à tort finit
 * par être désactivé. Celui-ci vise les deux affichages dont on a VU qu'ils
 * coexistent.
 */
describe("les deux affichages d'un même fait s'accordent", () => {
  const source = () =>
    sansCommentaires(readFileSync(join(process.cwd(), "components/dashboard/KpiCards.tsx"), "utf8"));

  it("le nombre de trades s'écrit pareil dans la mini-mesure et dans la carte", () => {
    const src = source();
    // La carte anime le nombre ; la mini-mesure l'écrit. Même source, sans condition.
    expect(src, "la carte ne lit plus weekCount").toContain("<CountUp end={weekCount}");
    expect(src, "la mini-mesure a repris une condition").toContain("value={String(weekCount)}");
    expect(src, "la mini-mesure remet un tiret sur un nombre connu").not.toContain(
      'weekCount > 0 ? String(weekCount) : "—"',
    );
  });

  it("le P&L du jour s'écrit pareil des deux côtés", () => {
    const src = source();
    expect(src, "la mini-mesure n'écrit plus le même montant").toContain(
      'money(todayPnl, currency, { digits: 2, signed: true })',
    );
    expect(src, "le P&L du jour redevient un tiret quand il vaut zéro").not.toMatch(
      /filteredTodayCount > 0[^]{0,200}"—"/,
    );
    /**
     * ⚠️⚠️ LA SEULE CONDITION ADMISE EST LA MÊME DES DEUX CÔTÉS. Les deux
     * affichages peuvent se taire ensemble (devises mêlées : aucun montant
     * n'existe), jamais séparément. C'est exactement le défaut d'origine, où
     * l'un écrivait « — » et l'autre « +0,00 € » à douze pixels d'écart.
     */
    const conditions = Array.from(src.matchAll(/deviseDuJourConnue/g)).length;
    expect(conditions, "les deux affichages ne sont plus gouvernés par la même condition")
      .toBeGreaterThanOrEqual(2);
    expect(src, "un des deux côtés a repris une condition qui lui est propre").not.toMatch(
      /todayPnl[^]{0,80}(filteredTodayCount|weekCount)\s*(>|===)/,
    );
  });

  /**
   * ⚠️⚠️ UN NOMBRE QUE LA LIGNE D'À CÔTÉ MULTIPLIE DOIT PORTER SA PRÉCISION.
   * La carte de synthèse d'Analytics affichait « Espérance +93€/trade » puis,
   * juste dessous, « Proj. 100 trades +9 304€ ». Le lecteur multiplie par cent
   * et trouve 9 300 : il croit à une erreur alors que c'est l'espérance qui
   * était tronquée (93,04). La projection, elle, était juste.
   */
  it("l'espérance s'écrit au centime, puisqu'elle est multipliée par cent", () => {
    const src = sansCommentaires(
      readFileSync(join(process.cwd(), "components/analytics/AnalyticsKpiCards.tsx"), "utf8"),
    );
    expect(src, "l'espérance est de nouveau arrondie à l'unité").not.toContain(
      "money(Math.round(expectancy), currency)",
    );
    expect(src).toContain("money(expectancy, currency, { digits: 2 })");
    // Et la projection reste bien le centuple de la même espérance.
    expect(src).toContain("Math.round(expectancy * 100)");
  });

  /**
   * ⚠️ ET LE TAUX DE RÉUSSITE GARDE SON TIRET : sans trade, il n'a pas de
   * dénominateur. Écrire « 0 % » dirait qu'on a perdu tous ses trades, ce qui
   * est faux et décourageant. Sans ce test, « harmoniser » finirait par lui
   * enlever son tiret aussi, au nom de la règle d'à côté.
   */
  it("le taux de réussite garde son tiret, faute de dénominateur", () => {
    const src = source();
    expect(src).toMatch(/weekCount > 0[^]{0,160}"—"/);
  });
});
