import { describe, expect, it } from "vitest";
import { computeCapitalLeaks, type LeakTrade } from "./leaks";

function mk(over: Partial<LeakTrade> & { open_time: string; pnl: number }): LeakTrade {
  return { commission: 0, swap: 0, close_time: null, lot_size: 1, emotion: null, ...over };
}

/** n trades neutres espacés d'une heure pour dépasser le volume minimal. */
function filler(n: number, startHour = 8, day = "2026-06-01"): LeakTrade[] {
  return Array.from({ length: n }, (_, i) =>
    mk({ open_time: `${day}T${String(startHour + i).padStart(2, "0")}:00:00`, pnl: 10 })
  );
}

describe("computeCapitalLeaks", () => {
  it("renvoie un résultat vide sous le volume minimal", () => {
    const res = computeCapitalLeaks(filler(5));
    expect(res.leaks).toEqual([]);
    expect(res.totalRecoverable).toBe(0);
    expect(res.tradesAnalyzed).toBe(5);
  });

  it("détecte le revenge trading (reprise < 30 min après une perte) et son coût", () => {
    const trades = [
      ...filler(9, 8, "2026-06-01"),
      mk({ open_time: "2026-06-02T10:00:00", close_time: "2026-06-02T10:20:00", pnl: -100 }),
      // repris 10 min après la clôture de la perte → revenge, et il perd
      mk({ open_time: "2026-06-02T10:30:00", pnl: -80 }),
    ];
    const res = computeCapitalLeaks(trades);
    const revenge = res.leaks.find((l) => l.type === "revenge");
    expect(revenge).toBeDefined();
    expect(revenge!.count).toBe(1);
    expect(revenge!.cost).toBe(80);
    expect(res.totalRecoverable).toBe(80);
  });

  it("ignore un trade repris vite après un GAIN (pas de revenge)", () => {
    const trades = [
      ...filler(9),
      mk({ open_time: "2026-06-02T10:00:00", close_time: "2026-06-02T10:20:00", pnl: 100 }),
      mk({ open_time: "2026-06-02T10:30:00", pnl: -80 }),
    ];
    const res = computeCapitalLeaks(trades);
    expect(res.leaks.find((l) => l.type === "revenge")).toBeUndefined();
  });

  it("ne rapporte pas une catégorie dont le net cumulé est positif", () => {
    const trades = [
      ...filler(9),
      mk({ open_time: "2026-06-02T10:00:00", close_time: "2026-06-02T10:10:00", pnl: -50 }),
      // revenge mais gagnant : l'habitude n'a rien coûté sur la période
      mk({ open_time: "2026-06-02T10:15:00", pnl: 200 }),
    ];
    const res = computeCapitalLeaks(trades);
    expect(res.leaks.find((l) => l.type === "revenge")).toBeUndefined();
    expect(res.totalRecoverable).toBe(0);
  });

  it("chiffre les trades sous émotion à risque", () => {
    const trades = [
      ...filler(8),
      mk({ open_time: "2026-06-02T10:00:00", pnl: -60, emotion: "fomo" }),
      mk({ open_time: "2026-06-02T14:00:00", pnl: -40, emotion: "revenge" }),
      mk({ open_time: "2026-06-02T16:00:00", pnl: 30, emotion: "calm" }),
    ];
    const res = computeCapitalLeaks(trades);
    const emo = res.leaks.find((l) => l.type === "emotional");
    expect(emo).toBeDefined();
    expect(emo!.count).toBe(2);
    expect(emo!.cost).toBe(100);
  });

  it("détecte l'overtrading au-delà de la limite quotidienne", () => {
    const day = "2026-06-13";
    // remplissage étalé sur 9 jours distincts pour ne pas dépasser la limite
    const spread = Array.from({ length: 9 }, (_, i) =>
      mk({ open_time: `2026-06-0${i + 1}T08:00:00`, pnl: 10 })
    );
    const trades = [
      ...spread,
      mk({ open_time: `${day}T09:00:00`, pnl: 20 }),
      mk({ open_time: `${day}T10:00:00`, pnl: 10 }),
      mk({ open_time: `${day}T11:00:00`, pnl: -70 }), // 3e trade > limite de 2
      mk({ open_time: `${day}T12:00:00`, pnl: -30 }), // 4e
    ];
    const res = computeCapitalLeaks(trades, { maxTradesPerDay: 2 });
    const over = res.leaks.find((l) => l.type === "overtrading");
    expect(over).toBeDefined();
    expect(over!.count).toBe(2);
    expect(over!.cost).toBe(100);
    expect(over!.meta?.maxPerDay).toBe(2);
  });

  it("n'évalue pas l'overtrading sans limite définie", () => {
    const day = "2026-06-03";
    const trades = [
      ...filler(9, 8, "2026-06-01"),
      ...Array.from({ length: 6 }, (_, i) => mk({ open_time: `${day}T0${i + 1}:30:00`, pnl: -10 })),
    ];
    const res = computeCapitalLeaks(trades);
    expect(res.leaks.find((l) => l.type === "overtrading")).toBeUndefined();
  });

  it("détecte le sizing tilt (lot gonflé après une perte)", () => {
    const trades = [
      ...filler(10, 8, "2026-06-01"), // lots à 1 → médiane 1
      mk({ open_time: "2026-06-02T10:00:00", close_time: "2026-06-02T10:30:00", pnl: -50, lot_size: 1 }),
      mk({ open_time: "2026-06-02T14:00:00", pnl: -120, lot_size: 3 }),
    ];
    const res = computeCapitalLeaks(trades);
    const oversizing = res.leaks.find((l) => l.type === "oversizing");
    expect(oversizing).toBeDefined();
    expect(oversizing!.count).toBe(1);
    expect(oversizing!.cost).toBe(120);
  });

  it("identifie la pire tranche horaire (≥ 5 trades, total négatif)", () => {
    const losers = Array.from({ length: 5 }, (_, i) =>
      mk({ open_time: `2026-06-0${i + 1}T09:15:00`, pnl: -40 })
    );
    const trades = [...filler(10, 12, "2026-06-01"), ...losers];
    const res = computeCapitalLeaks(trades);
    const bad = res.leaks.find((l) => l.type === "bad_hour");
    expect(bad).toBeDefined();
    expect(bad!.count).toBe(5);
    expect(bad!.cost).toBe(200);
    expect(bad!.meta?.hour).toBe(9);
  });

  it("ne double-compte pas un trade flagué par plusieurs catégories", () => {
    const trades = [
      ...filler(9),
      mk({ open_time: "2026-06-02T10:00:00", close_time: "2026-06-02T10:20:00", pnl: -100 }),
      // revenge ET émotionnel : compté une seule fois dans le total
      mk({ open_time: "2026-06-02T10:30:00", pnl: -80, emotion: "revenge" }),
    ];
    const res = computeCapitalLeaks(trades);
    expect(res.leaks.find((l) => l.type === "revenge")?.cost).toBe(80);
    expect(res.leaks.find((l) => l.type === "emotional")?.cost).toBe(80);
    expect(res.totalRecoverable).toBe(80);
    expect(res.flaggedCount).toBe(1);
  });

  it("commissions et swap entrent dans le net", () => {
    const trades = [
      ...filler(9),
      mk({ open_time: "2026-06-02T10:00:00", close_time: "2026-06-02T10:20:00", pnl: -100 }),
      mk({ open_time: "2026-06-02T10:30:00", pnl: -70, commission: -8, swap: -2 }),
    ];
    const res = computeCapitalLeaks(trades);
    expect(res.leaks.find((l) => l.type === "revenge")?.cost).toBe(80);
  });

  it("les fuites sont triées de la plus chère à la moins chère", () => {
    const trades = [
      ...filler(8),
      mk({ open_time: "2026-06-02T10:00:00", pnl: -20, emotion: "fomo" }),
      mk({ open_time: "2026-06-03T10:00:00", close_time: "2026-06-03T10:10:00", pnl: -300 }),
      mk({ open_time: "2026-06-03T10:20:00", pnl: -250 }),
    ];
    const res = computeCapitalLeaks(trades);
    expect(res.leaks.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < res.leaks.length; i++) {
      expect(res.leaks[i - 1].cost).toBeGreaterThanOrEqual(res.leaks[i].cost);
    }
    expect(res.leaks[0].type).toBe("revenge");
  });
});
