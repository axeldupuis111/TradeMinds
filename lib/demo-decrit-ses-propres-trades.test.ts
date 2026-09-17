import { describe, expect, it } from "vitest";
import { generateDemoTrades, demoStrategyRow } from "./demo-data";
import {
  computeMechanicalViolations,
  type SelectionStrategy,
  type SelectionTrade,
} from "./analysis-selection";

/**
 * LA FICHE DE DÉMONSTRATION DÉCRIT LES TRADES DE DÉMONSTRATION.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ UNE RÈGLE QU'AUCUNE LIGNE NE RESPECTE N'EST PAS UNE RÈGLE, C'EST DU BRUIT.
 * Mesuré le 2026-09-17 en rejouant les règles mécaniques sur le jeu de
 * démonstration : 51 violations « SL trop large » sur 53 trades. Le gabarit
 * annonçait `max_sl_pips: 25` pendant que son propre générateur produit des
 * stops de 43 à 61 pips de médiane selon l'instrument — et 25 pips n'a aucun
 * sens sur deux des quatre paires de la même fiche : 2,50 $ sur l'or, 25 points
 * sur le NAS100.
 *
 * ⚠️ ET `max_daily_loss: 150` : ce champ est un POURCENTAGE du capital. La
 * fiche annonçait donc une perte journalière maximale de 150 %, qu'aucune
 * journée ne peut atteindre, donc une règle qui ne se déclenche jamais.
 *
 * La visite guidée, qui est la surface d'acquisition du produit, affichait un
 * mur rouge au lieu d'une leçon.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Chaque limite de la fiche de démonstration est ATTEIGNABLE et DÉPASSÉE par
 * une minorité de ses trades : ni jamais (la règle ne montre rien), ni toujours
 * (elle ne distingue rien).
 */

const STRAT = demoStrategyRow("utilisateur-de-test") as unknown as SelectionStrategy & {
  max_daily_loss: number;
  max_sl_pips: number;
  risk_reward: number;
};
const TRADES = generateDemoTrades() as unknown as SelectionTrade[];

/** Le capital du compte de démonstration, contre lequel se lit un pourcentage. */
const CAPITAL_DEMO = 10_000;

function occurrences(type: string): number {
  const v = computeMechanicalViolations(TRADES, STRAT, CAPITAL_DEMO);
  return v.find((x) => x.type === type)?.occurrences ?? 0;
}

describe("le jeu de démonstration", () => {
  it("contient bien des trades, sinon ce test ne prouve rien", () => {
    expect(TRADES.length).toBeGreaterThan(30);
  });

  /**
   * ⚠️ LA BORNE HAUTE EST LE VRAI GARDE-FOU : c'est « presque tous » qui était
   * le défaut. La borne basse dit qu'il reste quelque chose à montrer.
   */
  const ATTENDUS: { type: string; min: number; max: number; quoi: string }[] = [
    { type: "sl_too_wide", min: 3, max: 25, quoi: "le stop trop large" },
    { type: "low_rr", min: 3, max: 40, quoi: "le RR sous le minimum" },
    { type: "wrong_session", min: 0, max: 25, quoi: "le hors-session" },
    { type: "max_trades_day", min: 1, max: 10, quoi: "le dépassement de trades/jour" },
    { type: "consecutive_losses", min: 1, max: 15, quoi: "les pertes consécutives" },
    { type: "max_daily_loss", min: 1, max: 6, quoi: "la perte journalière" },
  ];

  for (const { type, min, max, quoi } of ATTENDUS) {
    it(`montre ${quoi} sans en faire une constante`, () => {
      const n = occurrences(type);
      expect(
        n,
        `${type} ne se déclenche jamais sur le jeu de démonstration : la règle ` +
          `n'a rien à montrer au visiteur`,
      ).toBeGreaterThanOrEqual(min);
      expect(
        n,
        `${type} se déclenche ${n} fois sur ${TRADES.length} trades : ce n'est ` +
          `plus une leçon, c'est un mur rouge`,
      ).toBeLessThanOrEqual(max);
    });
  }

  /**
   * ⚠️⚠️ ET LES LIMITES SONT PLAUSIBLES EN ELLES-MÊMES, indépendamment du
   * comptage : c'est ce contrôle-là qui aurait attrapé « 150 % de perte
   * journalière » le jour où il a été écrit.
   */
  it("les limites de la fiche sont des nombres possibles", () => {
    expect(STRAT.max_daily_loss, "une perte journalière de plus de 100 % du capital").toBeLessThanOrEqual(100);
    expect(STRAT.max_daily_loss).toBeGreaterThan(0);
    expect(STRAT.risk_reward).toBeGreaterThan(0);
    /**
     * ⚠️ 25 pips, c'est 2,50 $ sur l'or et 25 points sur le NAS100 : la fiche
     * liste ces deux instruments, donc sa limite doit leur laisser une chance.
     */
    expect(STRAT.max_sl_pips, "un stop trop serré pour les instruments de la fiche").toBeGreaterThanOrEqual(40);
  });
});
