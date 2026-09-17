import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { selectSignificantTrades, type SelectionTrade } from "./analysis-selection";

/**
 * DEUX POSITIONS SIMULTANÉES NE SONT PAS UNE RÉACTION À UNE PERTE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ IL MANQUAIT LA BORNE BASSE, ET ELLE FAISAIT LA MAJORITÉ DU LOT. La
 * sélection marquait « moins_30min_apres_perte » dès que
 * `ouverture - clôture précédente < 30 min`, sans vérifier que l'écart soit
 * POSITIF. Un écart négatif veut dire que le trade s'est ouvert AVANT que le
 * précédent ne se referme : le trader ne pouvait même pas savoir qu'il perdait,
 * la perte n'était pas réalisée.
 *
 * ⚠️ MESURÉ EN PRODUCTION le 2026-09-17 sur les 447 trades : 195 paires dont le
 * précédent est perdant, 28 vraies ouvertures dans les trente minutes, et
 * 48 chevauchements. Près des deux tiers de ce que le serveur étiquetait ainsi
 * n'en était pas.
 *
 * ⚠️ ET CES TRADES-LÀ PARTENT DÉTAILLÉS DANS LE PROMPT, présentés au modèle
 * comme « ceux ouverts moins de 30 min après une perte », c'est-à-dire comme la
 * preuve d'un revenge trading. Le défaut ne se voyait nulle part à l'écran.
 *
 * ⚠️⚠️ LES DEUX AUTRES IMPLÉMENTATIONS DE LA MÊME RÈGLE AVAIENT LA BORNE :
 * `lib/analytics/leaks.ts` et `lib/analysis-insights.ts`. Celle qui parle au
 * modèle était la seule sans.
 */

const RACINE = process.cwd();

function trade(o: Partial<SelectionTrade>): SelectionTrade {
  return {
    open_time: "2026-09-01T09:00:00Z",
    close_time: "2026-09-01T09:30:00Z",
    pair: "EURUSD",
    direction: "long",
    entry_price: 1.1,
    exit_price: 1.1,
    sl: 1.09,
    tp: 1.12,
    pnl: 10,
    commission: 0,
    swap: 0,
    ...o,
  } as SelectionTrade;
}

/** Les index que la sélection retient pour la raison donnée. */
function marquesPour(trades: SelectionTrade[], raison: string): number[] {
  const res = selectSignificantTrades(trades, [], 50);
  return res.indices.filter((i) => (res.reasons?.[i] ?? []).includes(raison));
}

describe("le marquage « moins de 30 min après une perte »", () => {
  const perdant = trade({
    open_time: "2026-09-01T09:00:00Z",
    close_time: "2026-09-01T10:00:00Z",
    pnl: -100,
  });

  it("retient un trade ouvert dix minutes après la clôture perdante", () => {
    const suivant = trade({
      open_time: "2026-09-01T10:10:00Z",
      close_time: "2026-09-01T10:40:00Z",
    });
    expect(marquesPour([perdant, suivant], "moins_30min_apres_perte")).toContain(1);
  });

  /**
   * ⚠️⚠️ LE CAS QUI FAISAIT LES DEUX TIERS DU LOT : le second s'ouvre pendant
   * que le premier court encore. L'écart est NÉGATIF, et sans borne basse il
   * passait pour « moins de 30 minutes ».
   */
  it("ne retient pas un trade ouvert AVANT la clôture du perdant", () => {
    const pendant = trade({
      open_time: "2026-09-01T09:15:00Z",
      close_time: "2026-09-01T09:45:00Z",
    });
    expect(
      marquesPour([perdant, pendant], "moins_30min_apres_perte"),
      "une position simultanée est encore présentée au modèle comme un revenge trade",
    ).not.toContain(1);
  });

  it("ne retient pas un trade ouvert bien après", () => {
    const tard = trade({
      open_time: "2026-09-01T14:00:00Z",
      close_time: "2026-09-01T14:30:00Z",
    });
    expect(marquesPour([perdant, tard], "moins_30min_apres_perte")).not.toContain(1);
  });

  it("ne retient rien quand le précédent est gagnant", () => {
    const gagnant = trade({
      open_time: "2026-09-01T09:00:00Z",
      close_time: "2026-09-01T10:00:00Z",
      pnl: 100,
    });
    const suivant = trade({ open_time: "2026-09-01T10:10:00Z" });
    expect(marquesPour([gagnant, suivant], "moins_30min_apres_perte")).not.toContain(1);
  });

  /**
   * ⚠️ ET LA RÈGLE EST LA MÊME DANS LES TROIS FICHIERS QUI LA PORTENT. Deux
   * l'avaient, un ne l'avait pas, et c'était celui qui parle au modèle.
   */
  it("les trois implémentations bornent l'écart par le bas", () => {
    const sources: [string, RegExp][] = [
      ["lib/analysis-selection.ts", /ecart >= 0 && ecart < 30 \* 60 \* 1000/],
      ["lib/analytics/leaks.ts", /gap >= 0 && gap <= REVENGE_WINDOW_MS/],
      ["lib/analysis-insights.ts", /gapMin >= 0 && gapMin < 30/],
    ];
    const fautes: string[] = [];
    for (const [fichier, motif] of sources) {
      if (!motif.test(readFileSync(join(RACINE, fichier), "utf8"))) fautes.push(fichier);
    }
    expect(
      fautes,
      "implémentations sans borne basse : un chevauchement y passe pour une " +
        "réaction à une perte : " + fautes.join(", "),
    ).toEqual([]);
  });
});
