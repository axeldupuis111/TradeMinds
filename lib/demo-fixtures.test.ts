import { describe, expect, it } from "vitest";
import { generateDemoTrades } from "./demo-data";
import { DEMO_COACH, DEMO_MACRO, buildDemoAnalysis, demoTradeVerdict, type DemoTradeForAnalysis } from "./demo-fixtures";
import { locales } from "@/i18n/config";

const NOW = new Date("2026-07-30T12:00:00Z");
const trades = generateDemoTrades(NOW) as unknown as DemoTradeForAnalysis[];

describe("buildDemoAnalysis", () => {
  it("est déterministe : deux appels rendent la même analyse", () => {
    expect(buildDemoAnalysis(trades, "fr")).toEqual(buildDemoAnalysis(trades, "fr"));
  });

  it("ne référence que des index de trades qui existent vraiment", () => {
    const a = buildDemoAnalysis(trades, "fr");
    for (const v of a.violations) {
      for (const id of v.trade_ids) {
        expect(id).toBeGreaterThanOrEqual(0);
        expect(id).toBeLessThan(trades.length);
      }
    }
    for (const r of a.trade_reviews) {
      expect(trades[r.trade_id]).toBeDefined();
      // La fiche doit décrire le trade qu'elle prétend décrire.
      expect(r.pair).toBe(trades[r.trade_id].pair);
      expect(r.open_time).toBe(trades[r.trade_id].open_time);
    }
  });

  it("recalcule les chiffres depuis les trades, sans les inventer", () => {
    const a = buildDemoAnalysis(trades, "fr");
    const expected =
      Math.round(
        trades.reduce((s, t) => s + t.pnl + (t.commission || 0) + (t.swap || 0), 0) * 100
      ) / 100;
    expect(a.insights.total_net_pnl).toBeCloseTo(expected, 1);
    expect(a.total_trades).toBe(trades.length);
    expect(a.insights.win_rate).toBeGreaterThan(0);
    expect(a.insights.win_rate).toBeLessThanOrEqual(100);
  });

  it("détecte bien les trades fautifs du jeu de démo", () => {
    const a = buildDemoAnalysis(trades, "fr");
    // Le jeu contient une journée de tilt, une tranche de 9 h et des FOMO :
    // si l'un disparaît du générateur, l'analyse démo perd son sens.
    expect(a.insights.violation_trade_count).toBeGreaterThan(5);
    expect(a.insights.violation_cost).toBeGreaterThan(0);
    expect(a.conforming_trades).toBeLessThan(a.total_trades);
  });

  it("existe dans les 4 langues", () => {
    for (const loc of locales) {
      const a = buildDemoAnalysis(trades, loc);
      expect(a.headline).toBeTruthy();
      expect(a.summary).toBeTruthy();
      expect(a.recommendations.length).toBeGreaterThan(0);
    }
  });
});

describe("fixtures de démonstration", () => {
  it("couvre les 4 langues pour la macro et le coach", () => {
    for (const loc of locales) {
      expect(DEMO_MACRO[loc]?.tldr.length).toBeGreaterThan(0);
      expect(DEMO_MACRO[loc]?.themes.length).toBeGreaterThan(0);
      expect(DEMO_COACH[loc]?.length).toBeGreaterThan(0);
    }
  });

  it("annonce clairement que la macro est fictive dans chaque langue", () => {
    // Garde-fou de confiance : quelqu'un qui prendrait ce briefing pour une
    // vraie analyse pourrait ouvrir une position dessus.
    const marker: Record<string, RegExp> = {
      fr: /fictif|démonstration/i,
      en: /fictional|demonstration|sample/i,
      es: /ficticio|demostración/i,
      de: /fiktiv|Demonstration|Beispiel/i,
    };
    for (const loc of locales) {
      const m = DEMO_MACRO[loc];
      expect(`${m.headline} ${m.overview}`).toMatch(marker[loc]);
    }
  });
});

describe("demoTradeVerdict", () => {
  it("donne le verdict qui correspond au trade, pas un texte générique", () => {
    const base = { open_time: "2026-07-20T14:00:00Z" };
    const clean = demoTradeVerdict({ ...base, emotion: "calm" }, "fr");
    const tilt = demoTradeVerdict({ ...base, emotion: "revenge" }, "fr");
    const fomo = demoTradeVerdict({ ...base, emotion: "fomo" }, "fr");
    const morning = demoTradeVerdict({ open_time: "2026-07-20T09:00:00", emotion: null }, "fr");
    expect(clean.grade).toBe("A");
    expect(tilt.grade).toBe("D");
    expect(fomo.grade).toBe("D");
    expect(morning.grade).toBe("C");
    // Quatre verdicts distincts : sinon autant ne rien afficher.
    expect(new Set([clean.comment, tilt.comment, fomo.comment, morning.comment]).size).toBe(4);
  });

  it("couvre les 4 langues", () => {
    for (const loc of locales) {
      const v = demoTradeVerdict({ open_time: "2026-07-20T14:00:00Z", emotion: "calm" }, loc);
      expect(v.comment.length).toBeGreaterThan(30);
    }
  });

  it("est cohérent avec les trades réellement générés", () => {
    // Chaque trade démo doit tomber dans une catégorie, et les trades de tilt
    // doivent recevoir la pire note.
    for (const t of trades) {
      const v = demoTradeVerdict(t, "fr");
      expect(["A", "B", "C", "D"]).toContain(v.grade);
      if (t.emotion === "revenge" || t.emotion === "frustrated") expect(v.grade).toBe("D");
    }
  });
});
