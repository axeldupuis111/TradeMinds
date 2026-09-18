import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dayBreaches } from "./calendar-discipline";

/**
 * LE CALENDRIER MARQUE UNE JOURNÉE FAUTIVE : IL DOIT CONNAÎTRE TOUT LE PLAN.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ L'APLAT « HORS PÉRIMÈTRE » DU CALENDRIER SE CALCULAIT SUR UNE SEULE
 * FICHE, la plus ancienne, lue par un `.limit(1)`. Un trader qui écrit une
 * fiche par instrument — ce que le produit encourage et que le plan payant
 * débloque — voyait donc marquées fautives les journées où il avait suivi une
 * AUTRE de ses méthodes.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : un abonné premium à trois fiches, dont une
 * nommée « trendline nas100 », a 92 de ses 157 trades hors de la fiche « or ».
 * Le même défaut était corrigé le matin même côté analyse : une règle écrite,
 * appliquée à un écran sur deux.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le périmètre écrit d'un trader, c'est l'UNION de ses fiches, et la limite de
 * trades par jour la plus permissive. Une fiche sans liste de paires ne
 * restreint rien : elle ouvre tout.
 */

const RACINE = process.cwd();

describe("la journée fautive", () => {
  /** La règle elle-même n'a pas bougé : c'est ce qu'on lui donne qui change. */
  it("reste fautive quand l'instrument n'est dans aucune fiche", () => {
    expect(
      dayBreaches({ count: 1, netPnl: -10, pairs: ["BTCUSD"] }, {
        maxTradesPerDay: null,
        maxDailyLossEur: null,
        allowedPairs: ["XAUUSD", "NAS100"],
      }),
    ).toContain("wrong_pair");
  });

  /** ⚠️⚠️ LE CAS MESURÉ : l'union des fiches couvre l'instrument. */
  it("n'est pas fautive quand une autre fiche couvre l'instrument", () => {
    expect(
      dayBreaches({ count: 1, netPnl: -10, pairs: ["NAS100"] }, {
        maxTradesPerDay: null,
        maxDailyLossEur: null,
        allowedPairs: ["XAUUSD", "NAS100"],
      }),
      "une journée conforme à une autre méthode est marquée fautive",
    ).not.toContain("wrong_pair");
  });

  /** ⚠️ Et sans périmètre écrit, la règle ne se prononce pas. */
  it("ne se prononce pas sans périmètre écrit", () => {
    expect(
      dayBreaches({ count: 1, netPnl: -10, pairs: ["BTCUSD"] }, {
        maxTradesPerDay: null,
        maxDailyLossEur: null,
        allowedPairs: null,
      }),
    ).toEqual([]);
  });
});

describe("le tableau de bord", () => {
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les laisser ferait passer le
  // garde sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const src = readFileSync(join(RACINE, "app/dashboard/page.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  it("lit toutes les fiches, pas la plus ancienne", () => {
    const i = src.indexOf('from("strategies")');
    expect(i, "la lecture des fiches a disparu").toBeGreaterThan(0);
    const lecture = src.slice(i, src.indexOf("\n", i));
    expect(
      lecture,
      "le calendrier juge encore sur une seule fiche : les journées suivant " +
        "une autre méthode passeront pour fautives",
    ).not.toContain("limit(1)");
  });

  it("compose le périmètre à partir de l'union", () => {
    expect(src, "le périmètre n'est plus l'union des fiches").toContain("pairesAutorisees");
    expect(src, "une fiche sans liste de paires doit tout ouvrir").toContain("uneFicheOuvreTout");
  });

  /**
   * ⚠️ ET LA LIMITE DE TRADES PAR JOUR SUIT LA MÊME RÈGLE : la plus permissive,
   * et rien du tout si une fiche n'écrit pas de limite.
   */
  it("retient la limite de trades par jour la plus permissive", () => {
    expect(src).toContain("maxTradesParJour");
    const i = src.indexOf("const maxTradesParJour");
    const bloc = src.slice(i, src.indexOf(";", src.indexOf("Math.max", i)));
    expect(bloc, "une fiche sans limite écrite doit rendre la règle injugeable").toContain(
      "max_trades_per_day == null",
    );
  });
});
