import { describe, expect, it } from "vitest";
import {
  computeMechanicalViolations,
  renderMechanicalBlock,
  selectSignificantTrades,
  type SelectionStrategy,
  type SelectionTrade,
} from "./analysis-selection";

const base: SelectionTrade = {
  open_time: "2026-08-03T09:00:00.000Z",
  close_time: "2026-08-03T10:00:00.000Z",
  pair: "EURUSD",
  direction: "buy",
  lot_size: 0.1,
  entry_price: 1.1,
  exit_price: 1.105,
  // conforme à `strat` : risque 20 pips (max 30), RR planifié 2.0 (min 2)
  sl: 1.098,
  tp: 1.104,
  pnl: 50,
  commission: 0,
  swap: 0,
  ict_setup: "FVG",
};
const t = (o: Partial<SelectionTrade> = {}): SelectionTrade => ({ ...base, ...o });

const strat: SelectionStrategy = {
  pairs: ["EURUSD", "GBPUSD"],
  sessions: ["london"], // 08:00–12:00 UTC
  risk_reward: 2,
  max_sl_pips: 30,
  max_trades_per_day: 3,
  max_consecutive_losses: 2,
};

const find = (vs: ReturnType<typeof computeMechanicalViolations>, type: string) =>
  vs.find((v) => v.type === type);

describe("computeMechanicalViolations", () => {
  it("repère une paire hors périmètre", () => {
    const v = computeMechanicalViolations([t(), t({ pair: "XAUUSD" })], strat);
    expect(find(v, "wrong_pair")).toMatchObject({ occurrences: 1, trade_ids: [1], category: "strategy" });
  });

  it("normalise le format de la paire (EUR/USD == EURUSD)", () => {
    const v = computeMechanicalViolations([t({ pair: "eur/usd" })], strat);
    expect(find(v, "wrong_pair")).toBeUndefined();
  });

  it("ne vérifie pas les paires si la stratégie n'en liste aucune", () => {
    const v = computeMechanicalViolations([t({ pair: "XAUUSD" })], { ...strat, pairs: [] });
    expect(find(v, "wrong_pair")).toBeUndefined();
  });

  it("repère un trade hors session", () => {
    const v = computeMechanicalViolations([t({ open_time: "2026-08-03T20:00:00.000Z" })], strat);
    expect(find(v, "wrong_session")?.occurrences).toBe(1);
  });

  it("compte les SL et TP manquants, en tenant compte du SL initial", () => {
    const v = computeMechanicalViolations(
      [t({ sl: null, tp: null }), t({ sl: null, sl_initial: 1.095 })],
      strat,
    );
    // le 2e a un sl_initial : ce n'est pas un trade sans SL
    expect(find(v, "missing_sl")).toMatchObject({ occurrences: 1, trade_ids: [0], category: "execution" });
    expect(find(v, "missing_tp")?.occurrences).toBe(1);
  });

  it("repère un SL trop large et un RR insuffisant", () => {
    // entrée 1.1, SL 1.09 => 100 pips (> 30) ; TP 1.11 => 100 pips => RR 1 (< 2)
    const v = computeMechanicalViolations([t({ sl: 1.09, tp: 1.11 })], strat);
    expect(find(v, "sl_too_wide")?.occurrences).toBe(1);
    expect(find(v, "low_rr")?.occurrences).toBe(1);
  });

  it("ne vérifie pas une règle laissée indéfinie", () => {
    const v = computeMechanicalViolations([t({ sl: 1.09, tp: 1.11 })], {
      ...strat,
      max_sl_pips: null,
      risk_reward: null,
    });
    expect(find(v, "sl_too_wide")).toBeUndefined();
    expect(find(v, "low_rr")).toBeUndefined();
  });

  it("compte les JOURS de dépassement, pas les trades", () => {
    const day = (d: string, n: number) =>
      Array.from({ length: n }, (_, i) =>
        t({ open_time: `${d}T0${9 + (i % 3)}:00:00.000Z`, close_time: `${d}T11:00:00.000Z` }),
      );
    const v = computeMechanicalViolations([...day("2026-08-03", 5), ...day("2026-08-04", 5)], strat);
    expect(find(v, "max_trades_day")?.occurrences).toBe(2); // 2 jours fautifs
  });

  it("compte les trades pris au-delà de la série de pertes autorisée", () => {
    const loss = (i: number) =>
      t({ open_time: `2026-08-03T0${9 + i}:00:00.000Z`, pnl: -100, ict_setup: null });
    // 4 pertes d'affilée, seuil 2 => les 3e et 4e sont fautives
    const v = computeMechanicalViolations([loss(0), loss(1), loss(2), loss(3)], strat);
    expect(find(v, "consecutive_losses")?.occurrences).toBe(2);
  });

  it("traite un quasi-nul comme un breakeven, qui casse la série", () => {
    const at = (h: number, pnl: number) => t({ open_time: `2026-08-03T${String(h).padStart(2, "0")}:00:00.000Z`, pnl });
    const v = computeMechanicalViolations([at(8, -100), at(9, -100), at(10, 0.5), at(11, -100)], strat);
    expect(find(v, "consecutive_losses")).toBeUndefined();
  });

  it("ne renvoie rien quand tout est conforme", () => {
    expect(computeMechanicalViolations([t()], strat)).toEqual([]);
  });
});

describe("selectSignificantTrades", () => {
  it("retient les trades fautifs et borne la sélection", () => {
    const trades = Array.from({ length: 300 }, (_, i) =>
      t({ pnl: i % 2 ? 10 : -10, pair: i === 42 ? "XAUUSD" : "EURUSD" }),
    );
    const v = computeMechanicalViolations(trades, strat);
    const { indices, reasons } = selectSignificantTrades(trades, v, 40);

    expect(indices.length).toBeLessThanOrEqual(40);
    expect(indices).toContain(42); // la paire interdite est une pièce à conviction
    expect(reasons[42]).toContain("wrong_pair");
    expect([...indices]).toEqual([...indices].sort((a, b) => a - b)); // ordre conservé
  });

  it("retient les pires et les meilleurs résultats", () => {
    const trades = [t({ pnl: -900 }), t({ pnl: 5 }), t({ pnl: 900 })];
    const { reasons } = selectSignificantTrades(trades, [], 40);
    expect(reasons[0]).toContain("pire_resultat");
    expect(reasons[2]).toContain("meilleur_resultat");
  });

  it("repère un trade ouvert moins de 30 min après une perte", () => {
    const trades = [
      t({ open_time: "2026-08-03T09:00:00.000Z", close_time: "2026-08-03T09:30:00.000Z", pnl: -100 }),
      t({ open_time: "2026-08-03T09:40:00.000Z", close_time: "2026-08-03T10:00:00.000Z", pnl: -50 }),
    ];
    const { reasons } = selectSignificantTrades(trades, [], 40);
    expect(reasons[1]).toContain("moins_30min_apres_perte");
  });

  it("garde les index d'origine, pas ceux de la sélection", () => {
    const trades = Array.from({ length: 50 }, (_, i) => t({ pnl: i === 49 ? -5000 : 1 }));
    const { indices } = selectSignificantTrades(trades, [], 5);
    expect(indices).toContain(49);
    expect(Math.max(...indices)).toBeLessThan(trades.length);
  });
});

describe("renderMechanicalBlock", () => {
  it("annonce explicitement l'absence de violation", () => {
    expect(renderMechanicalBlock([], 120)).toContain("Aucune violation mécanique");
  });

  it("précise l'unité des règles par jour", () => {
    const v = computeMechanicalViolations(
      Array.from({ length: 5 }, () => t()),
      strat,
    );
    const txt = renderMechanicalBlock(v, 5);
    expect(txt).toContain("max_trades_day");
    expect(txt).toContain("jour(s)");
  });
});
