import { describe, expect, it } from "vitest";
import { mesurerAdherence, type TradeAdherence } from "./strategy-adherence";

/**
 * CE QUE CES TESTS PROTÈGENT.
 *
 * La mesure d'écart ne vaut que si elle est INATTAQUABLE. Le trader à qui on
 * dit « tu as dépassé ta limite 4 jours sur 30 » doit pouvoir vérifier, et ne
 * jamais pouvoir répondre « je n'ai jamais dit ça ». D'où les deux propriétés
 * tenues ici : on ne mesure que ce qu'il a écrit, et on ne flatte pas quand il
 * n'y a rien à mesurer.
 */

/** Journée fabriquée : n trades, dont les P&L sont donnés dans l'ordre. */
function jour(date: string, pnls: number[]): TradeAdherence[] {
  return pnls.map((netPnl, i) => ({
    open_time: `${date}T${String(9 + i).padStart(2, "0")}:00:00.000Z`,
    netPnl,
  }));
}

const CAPITAL = 10_000;

describe("on ne mesure que les règles réellement posées", () => {
  it("une fiche sans règle chiffrée ne produit aucune mesure", () => {
    const a = mesurerAdherence(jour("2026-01-05", [-100, -100, -100]), {}, CAPITAL);
    expect(a.regles).toHaveLength(0);
  });

  it("et surtout, elle ne rend pas un taux de 100 %", () => {
    // ⚠️ LA FLATTERIE QU'ON REFUSE. Annoncer « 100 % de respect » à quelqu'un
    // qui n'a posé aucune règle, c'est le féliciter de n'avoir rien promis.
    // Celui qui comprend le calcul cesse de croire tout le reste de la page.
    const a = mesurerAdherence(jour("2026-01-05", [-100]), {}, CAPITAL);
    expect(a.taux).toBeNull();
  });

  it("une règle posée mais non mesurable disparaît au lieu d'être évaluée à vide", () => {
    // Sans capital connu, « 2 % par trade » ne se convertit pas en euros. On
    // retire la règle plutôt que de l'évaluer sur une base inventée.
    const a = mesurerAdherence(jour("2026-01-05", [-500]), { risk_per_trade_pct: 2 }, 0);
    expect(a.regles.map((r) => r.code)).not.toContain("adh_risque");
  });
});

describe("la cadence se compte en journées, pas en trades", () => {
  const REGLES = { max_trades_per_day: 3 };

  it("une journée à quatre trades est un écart, une à trois ne l'est pas", () => {
    const trades = [...jour("2026-01-05", [10, 10, 10, 10]), ...jour("2026-01-06", [10, 10, 10])];
    const r = mesurerAdherence(trades, REGLES, CAPITAL).regles[0];
    expect(r.code).toBe("adh_cadence");
    expect(r.ecarts).toBe(1);
    expect(r.occasions).toBe(2);
    expect(r.declare).toBe(3);
    expect(r.pire).toBe(4);
  });

  it("le pire dépassement donne l'échelle du problème", () => {
    const trades = [...jour("2026-01-05", [10, 10, 10, 10]), ...jour("2026-01-06", Array(9).fill(10))];
    const r = mesurerAdherence(trades, REGLES, CAPITAL).regles[0];
    expect(r.ecarts).toBe(2);
    expect(r.pire).toBe(9);
  });

  it("respecter sa cadence donne zéro écart", () => {
    const r = mesurerAdherence(jour("2026-01-05", [10, 10]), REGLES, CAPITAL).regles[0];
    expect(r.ecarts).toBe(0);
    expect(mesurerAdherence(jour("2026-01-05", [10, 10]), REGLES, CAPITAL).taux).toBe(1);
  });
});

describe("une perte plus lourde que le risque déclaré est un écart", () => {
  const REGLES = { risk_per_trade_pct: 2 }; // 200 EUR sur 10 000

  it("une perte de 500 dépasse un risque déclaré de 200", () => {
    const r = mesurerAdherence(jour("2026-01-05", [-500, -150, 800]), REGLES, CAPITAL).regles[0];
    expect(r.code).toBe("adh_risque");
    expect(r.ecarts).toBe(1);
    expect(r.declare).toBe(200);
    expect(r.pire).toBe(500);
  });

  it("un GAIN, même énorme, n'est jamais un écart de risque", () => {
    // ⚠️ Le risque porte sur ce qu'on perd. Compter un gros gain comme une
    // entorse serait absurde, et c'est le genre de bug qu'un signe mal placé
    // introduit sans bruit.
    const r = mesurerAdherence(jour("2026-01-05", [5000, 4000]), REGLES, CAPITAL).regles[0];
    expect(r.ecarts).toBe(0);
  });

  it("une perte pile au plafond passe, une perte au-dessus non", () => {
    const r = mesurerAdherence(jour("2026-01-05", [-200, -201]), REGLES, CAPITAL).regles[0];
    expect(r.ecarts).toBe(1);
  });
});

describe("la règle d'arrêt se juge sur la série la plus longue de la journée", () => {
  const REGLES = { max_consecutive_losses: 2 };

  it("trois pertes d'affilée dépassent une limite de deux", () => {
    const r = mesurerAdherence(jour("2026-01-05", [-10, -10, -10]), REGLES, CAPITAL).regles[0];
    expect(r.code).toBe("adh_serie");
    expect(r.ecarts).toBe(1);
    expect(r.pire).toBe(3);
  });

  it("un gain au milieu casse la série", () => {
    const r = mesurerAdherence(jour("2026-01-05", [-10, -10, 50, -10, -10]), REGLES, CAPITAL).regles[0];
    expect(r.ecarts).toBe(0);
    expect(r.pire).toBe(0);
  });

  it("la série ne court pas d'une journée à l'autre", () => {
    // Deux pertes hier, deux aujourd'hui : ce ne sont pas quatre d'affilée. La
    // décision de continuer se prend dans la séance, pas par-dessus la nuit.
    const trades = [...jour("2026-01-05", [-10, -10]), ...jour("2026-01-06", [-10, -10])];
    const r = mesurerAdherence(trades, REGLES, CAPITAL).regles[0];
    expect(r.ecarts).toBe(0);
  });
});

describe("le taux agrège toutes les règles posées", () => {
  it("un trader qui tient tout est à 100 %", () => {
    const a = mesurerAdherence(
      jour("2026-01-05", [-100, 200]),
      { max_trades_per_day: 5, max_consecutive_losses: 3, risk_per_trade_pct: 2 },
      CAPITAL,
    );
    expect(a.taux).toBe(1);
    expect(a.regles).toHaveLength(3);
  });

  it("un trader qui déborde partout tombe nettement sous 100 %", () => {
    const a = mesurerAdherence(
      jour("2026-01-05", [-500, -500, -500, -500]),
      { max_trades_per_day: 2, max_consecutive_losses: 2, risk_per_trade_pct: 2 },
      CAPITAL,
    );
    expect(a.taux).not.toBeNull();
    expect(a.taux!).toBeLessThan(0.5);
  });

  it("les journées et les trades comptés sont ceux qu'on a reçus", () => {
    const trades = [...jour("2026-01-05", [10, 10]), ...jour("2026-01-06", [10])];
    const a = mesurerAdherence(trades, { max_trades_per_day: 5 }, CAPITAL);
    expect(a.trades).toBe(3);
    expect(a.jours).toBe(2);
  });

  it("un journal vide ne fait rien exploser", () => {
    const a = mesurerAdherence([], { max_trades_per_day: 3 }, CAPITAL);
    expect(a.trades).toBe(0);
    expect(a.jours).toBe(0);
    expect(a.taux).toBeNull();
  });
});

describe("le regroupement par journée suit le fuseau du trader", () => {
  it("deux trades à cheval sur minuit UTC peuvent être le même jour à Paris", () => {
    // ⚠️ Sans fuseau, un trade de 23h30 à Paris tombe le lendemain en UTC, et la
    // limite journalière est comptée sur la mauvaise journée. C'est le même
    // piège que l'heure serveur des brokers.
    const trades: TradeAdherence[] = [
      { open_time: "2026-01-05T21:30:00.000Z", netPnl: -10 },
      { open_time: "2026-01-05T23:30:00.000Z", netPnl: -10 },
    ];
    const paris = mesurerAdherence(trades, { max_trades_per_day: 1 }, CAPITAL, "Europe/Paris");
    // 22h30 et 00h30 heure de Paris : deux journées distinctes, donc aucune ne
    // dépasse la limite de 1.
    expect(paris.regles[0].ecarts).toBe(0);
    expect(paris.jours).toBe(2);
  });
});
