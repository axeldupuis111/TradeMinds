import { describe, expect, it } from "vitest";
import { MIN_TRADES_SEGMENT, analyserSegments, type TradeSegmente } from "./projection-segments";

/**
 * CE QUE CES TESTS PROTÈGENT.
 *
 * Chercher le pire segment parmi des dizaines de valeurs trouve TOUJOURS
 * quelque chose, y compris dans du bruit pur. Un outil qui l'ignore fabrique
 * des règles convaincantes qui ne survivent pas au mois suivant, ce qui est
 * pire que de ne rien dire.
 *
 * Les tests ci-dessous vérifient donc surtout des REFUS : sous le seuil de
 * trades, sous le seuil de poids, ou quand le retrait viderait le journal.
 */

const OPTIONS = { annees: 2, capitalDepart: 10_000 };

/** Construit un journal, un trade par jour, avec les dimensions demandées. */
function journal(
  entrees: { n: number; pnl: number; pair?: string; emotion?: string }[],
): TradeSegmente[] {
  const out: TradeSegmente[] = [];
  let jour = 0;
  for (const e of entrees) {
    for (let i = 0; i < e.n; i++) {
      const d = new Date(Date.UTC(2025, 0, 1) + jour * 86_400_000);
      out.push({
        open_time: d.toISOString(),
        netPnl: e.pnl,
        pair: e.pair ?? "EURUSD",
        emotion: e.emotion ?? null,
        direction: "long",
      });
      jour++;
    }
  }
  return out;
}

describe("le segment qui coûte est nommé", () => {
  it("un instrument nettement déficitaire ressort en tête", () => {
    const j = journal([
      { n: 120, pnl: 20, pair: "EURUSD" },
      { n: 40, pnl: -200, pair: "XAUUSD" },
    ]);
    const a = analyserSegments(j, OPTIONS);
    expect(a.couteux[0].dimension).toBe("pair");
    expect(a.couteux[0].cle).toBe("XAUUSD");
    expect(a.couteux[0].trades).toBe(40);
    expect(a.couteux[0].netPnl).toBe(-8000);
    expect(a.couteux[0].esperance).toBe(-200);
  });

  it("le contrefactuel rejoue la projection sans lui", () => {
    const j = journal([
      { n: 120, pnl: 20, pair: "EURUSD" },
      { n: 40, pnl: -200, pair: "XAUUSD" },
    ]);
    const a = analyserSegments(j, OPTIONS);
    expect(a.contrefactuel).not.toBeNull();
    expect(a.contrefactuel!.segment.cle).toBe("XAUUSD");
    // Sans le segment déficitaire, l'espérance restante est positive.
    expect(a.contrefactuel!.projection.esperance).toBeGreaterThan(0);
  });

  it("une émotion peut être le segment coûteux, pas seulement un instrument", () => {
    const j = journal([
      { n: 120, pnl: 20, emotion: "calme" },
      { n: 40, pnl: -200, emotion: "frustre" },
    ]);
    const a = analyserSegments(j, OPTIONS);
    expect(a.couteux.some((s) => s.dimension === "emotion" && s.cle === "frustre")).toBe(true);
  });
});

describe("les refus, qui sont la vraie valeur du module", () => {
  it("un segment trop petit n'est jamais nommé, même s'il est catastrophique", () => {
    // ⚠️ LE CŒUR DU GARDE-FOU. Cinq trades à -1 000 sautent aux yeux et ne
    // prouvent rien. Les remonter fabriquerait une règle sur du bruit.
    const j = journal([
      { n: 150, pnl: 20, pair: "EURUSD" },
      { n: 5, pnl: -1000, pair: "BTCUSD" },
    ]);
    const a = analyserSegments(j, OPTIONS);
    expect(a.couteux.some((s) => s.cle === "BTCUSD")).toBe(false);
  });

  it("le seuil est bien celui qu'on annonce", () => {
    const sous = journal([
      { n: 150, pnl: 20, pair: "EURUSD" },
      { n: MIN_TRADES_SEGMENT - 1, pnl: -500, pair: "BTCUSD" },
    ]);
    const juste = journal([
      { n: 150, pnl: 20, pair: "EURUSD" },
      { n: MIN_TRADES_SEGMENT, pnl: -500, pair: "BTCUSD" },
    ]);
    expect(analyserSegments(sous, OPTIONS).couteux.some((s) => s.cle === "BTCUSD")).toBe(false);
    expect(analyserSegments(juste, OPTIONS).couteux.some((s) => s.cle === "BTCUSD")).toBe(true);
  });

  it("un segment qui pèse peu dans le déficit n'est pas un levier", () => {
    // Il perd, il a assez de trades, mais il représente une miette du déficit
    // total. Le nommer détournerait l'attention de ce qui compte vraiment.
    const j = journal([
      { n: 60, pnl: -500, pair: "XAUUSD" },
      { n: 60, pnl: -1, pair: "EURUSD" },
      { n: 60, pnl: 100, pair: "GBPUSD" },
    ]);
    const a = analyserSegments(j, OPTIONS);
    expect(a.couteux.some((s) => s.cle === "EURUSD")).toBe(false);
    expect(a.couteux[0].cle).toBe("XAUUSD");
  });

  it("un journal trop court ne produit aucune analyse", () => {
    expect(analyserSegments(journal([{ n: 40, pnl: -50 }]), OPTIONS).couteux).toHaveLength(0);
  });

  it("un journal sans perte concentrée ne nomme personne", () => {
    const a = analyserSegments(journal([{ n: 200, pnl: 15, pair: "EURUSD" }]), OPTIONS);
    expect(a.couteux).toHaveLength(0);
    expect(a.contrefactuel).toBeNull();
  });

  it("si retirer le segment vide le journal, on ne montre pas de contrefactuel", () => {
    // ⚠️ Remplacer un verdict par un autre encore moins fondé serait une
    // régression déguisée en fonctionnalité.
    const j = journal([
      { n: 60, pnl: 20, pair: "EURUSD" },
      { n: 60, pnl: -200, pair: "XAUUSD" },
    ]);
    const a = analyserSegments(j, OPTIONS);
    expect(a.couteux.length).toBeGreaterThan(0);
    expect(a.contrefactuel).toBeNull();
  });
});

describe("les dimensions temporelles suivent le fuseau du trader", () => {
  it("l'heure regroupée est l'heure locale, jamais l'heure UTC", () => {
    // ⚠️ CE QU'ON TESTE, ET CE QU'ON NE TESTE PAS. Des trades à 22h UTC tombent
    // à 23h à Paris l'hiver et à minuit l'été : sur une série longue, les deux
    // existent. Épingler « 00 » aurait été une erreur de MA part, pas du code,
    // et le banc me l'a dit. La propriété qui compte n'est pas quelle heure
    // locale sort, c'est que l'heure UTC n'en sorte JAMAIS : sinon le « 22h qui
    // te coûte cher » désignerait une heure que le trader n'a pas vécue.
    const trades: TradeSegmente[] = Array.from({ length: 150 }, (_, i) => ({
      open_time: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000 + 22 * 3_600_000).toISOString(),
      netPnl: -50,
      pair: "EURUSD",
    }));
    const heures = analyserSegments(trades, OPTIONS, "Europe/Paris")
      .couteux.filter((s) => s.dimension === "hour")
      .map((s) => s.cle);
    expect(heures.length).toBeGreaterThan(0);
    expect(heures).not.toContain("22");
    for (const h of heures) expect(["23", "00"]).toContain(h);
  });

  it("un fuseau invalide ne fait pas échouer l'analyse", () => {
    const j = journal([
      { n: 120, pnl: 20, pair: "EURUSD" },
      { n: 40, pnl: -200, pair: "XAUUSD" },
    ]);
    const a = analyserSegments(j, OPTIONS, "Pas/UnFuseau");
    expect(a.couteux.length).toBeGreaterThan(0);
  });
});

describe("le module décrit le passé, il ne promet rien", () => {
  it("aucun segment ne porte de projection propre, seulement ce qu'il a coûté", () => {
    // ⚠️ La frontière : « ce segment t'a coûté 8 000 » est un constat sur son
    // journal. « retire-le et tu gagneras » serait une promesse, et surtout un
    // sur-apprentissage : le segment a été choisi APRÈS avoir vu les données.
    const j = journal([
      { n: 120, pnl: 20, pair: "EURUSD" },
      { n: 40, pnl: -200, pair: "XAUUSD" },
    ]);
    for (const s of analyserSegments(j, OPTIONS).couteux) {
      expect(Object.keys(s).sort()).toEqual(
        ["cle", "dimension", "esperance", "netPnl", "part", "trades"].sort(),
      );
    }
  });

  it("les segments sont classés du plus coûteux au moins coûteux", () => {
    const j = journal([
      { n: 100, pnl: 30, pair: "EURUSD" },
      { n: 40, pnl: -100, pair: "GBPUSD" },
      { n: 40, pnl: -300, pair: "XAUUSD" },
    ]);
    const c = analyserSegments(j, OPTIONS).couteux;
    for (let i = 1; i < c.length; i++) {
      expect(c[i].netPnl).toBeGreaterThanOrEqual(c[i - 1].netPnl);
    }
  });
});
