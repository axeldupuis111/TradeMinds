import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeMechanicalViolations, renderMechanicalBlock, type SelectionStrategy, type SelectionTrade } from "./analysis-selection";
import { computeViolationCosts } from "./analysis-insights";
import { tradesConformes } from "./trades-conformes";

/**
 * UNE VIOLATION CITE TOUS LES TRADES QU'ELLE COMPTE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA LISTE DES TRADES FAUTIFS ÉTAIT PLAFONNÉE À VINGT, ET TROIS MESURES
 * S'EN SERVAIENT COMME SI ELLE ÉTAIT COMPLÈTE :
 *
 *   - le COÛT de la violation (« cette erreur t'a coûté X »), qui additionne le
 *     P&L des trades cités (`computeViolationCosts`) ;
 *   - la COURBE CONTREFACTUELLE, qui retire ces trades de l'équité ;
 *   - le compte de TRADES CONFORMES affiché en tête de l'analyse
 *     (`tradesConformes` : total moins les index cités).
 *
 * ⚠️ LE PLAFOND AVAIT ÉTÉ POSÉ POUR LE PROMPT, QUI N'EN AVAIT PAS BESOIN :
 * `renderMechanicalBlock` ne cite déjà que DIX index, « à titre d'exemple », et
 * le comptage qu'il transmet est `occurrences`, exact. Le plafond ne protégeait
 * donc rien et faussait tout le reste.
 *
 * ⚠️ REJOUÉ SUR LES DONNÉES DE PRODUCTION LE 2026-09-18, stratégie par
 * stratégie : `missing_tp` compte 137 occurrences et n'en citait que 20,
 * `missing_sl` 128 pour 20, `wrong_pair` 92 pour 20. Le coût annoncé portait
 * sur 15 % des trades fautifs, et l'en-tête « N trades conformes » en comptait
 * une centaine de trop — sur une analyse payée.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * La donnée est complète ; c'est le RENDU qui coupe. Une mesure ne se calcule
 * jamais sur une liste tronquée pour l'affichage.
 */

const RACINE = process.cwd();

const STRATEGIE: SelectionStrategy = {
  pairs: ["XAUUSD"],
  sessions: [],
  risk_reward: null,
  max_sl_pips: null,
  max_trades_per_day: null,
  max_consecutive_losses: null,
  max_daily_loss: null,
};

/** `n` trades sur une paire hors stratégie : chacun est une violation. */
function journal(n: number): SelectionTrade[] {
  return Array.from({ length: n }, (_, i) => ({
    open_time: `2026-0${1 + (i % 3)}-1${i % 9}T10:00:00Z`,
    close_time: `2026-0${1 + (i % 3)}-1${i % 9}T11:00:00Z`,
    pair: "NAS100",
    direction: "long",
    entry_price: 4000,
    exit_price: 3990,
    lot_size: 1,
    sl: 3980,
    tp: 4050,
    pnl: -10,
    commission: 0,
    swap: 0,
  })) as SelectionTrade[];
}

describe("les trades cités par une violation", () => {
  /** ⚠️⚠️ L'ORDRE DE GRANDEUR MESURÉ EN PRODUCTION : bien plus de vingt. */
  it("les cite tous, pas les vingt premiers", () => {
    const v = computeMechanicalViolations(journal(137), STRATEGIE);
    const paire = v.find((x) => x.type === "wrong_pair");
    expect(paire, "la règle de paire ne se déclenche plus").toBeDefined();
    expect(paire!.occurrences).toBe(137);
    expect(
      paire!.trade_ids.length,
      "la liste est de nouveau tronquée : le coût et les trades conformes seront faux",
    ).toBe(137);
  });

  /** ⚠️ Le coût porte alors sur tous les trades fautifs, pas sur vingt. */
  it("le coût additionne tous les trades fautifs", () => {
    const trades = journal(137);
    const v = computeMechanicalViolations(trades, STRATEGIE);
    const couts = computeViolationCosts(
      v.map((x) => ({ trade_ids: x.trade_ids })),
      trades.map((t) => ({ pnl: t.pnl, commission: t.commission, swap: t.swap, close_time: t.close_time })) as never,
    );
    const paire = v.findIndex((x) => x.type === "wrong_pair");
    expect(couts.perViolation[paire], "le coût ne couvre qu'une partie des fautes").toBe(-1370);
  });

  /** ⚠️ Et « N trades conformes » ne compte plus des fautifs comme conformes. */
  it("aucun trade fautif ne passe pour conforme", () => {
    const v = computeMechanicalViolations(journal(137), STRATEGIE);
    expect(
      tradesConformes(137, v.map((x) => ({ trade_ids: x.trade_ids }))),
      "des trades fautifs sont comptés comme conformes",
    ).toBe(0);
  });

  /**
   * ⚠️ LE PROMPT, LUI, COUPE TOUJOURS : c'est là que la limite a un sens, et
   * elle y était déjà. Le nombre transmis au modèle reste `occurrences`, exact.
   */
  it("le prompt ne cite que dix index, et donne le compte exact", () => {
    const v = computeMechanicalViolations(journal(137), STRATEGIE);
    const bloc = renderMechanicalBlock(v, 137);
    expect(bloc, "le comptage exact a disparu du prompt").toContain("137 trade(s)");
    const exemples = /exemples d'index : ([^\n]*)/.exec(bloc);
    expect(exemples, "les exemples d'index ont disparu").not.toBeNull();
    expect(
      exemples![1].split(",").length,
      "le prompt recopie toute la liste : des centaines d'index pour rien",
    ).toBe(10);
  });

  /** ⚠️ Et le plafond n'est pas revenu en douce sur une des règles par jour. */
  it("aucune règle ne tronque plus sa liste", () => {
    const src = readFileSync(join(RACINE, "lib/analysis-selection.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(src, "une liste de trades fautifs est de nouveau tronquée").not.toMatch(
      /trade_ids:\s*\w+\.slice\(/,
    );
  });
});
