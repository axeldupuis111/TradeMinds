import { describe, expect, it } from "vitest";
import { palierSousLeSeuil, paliersDeTaille } from "./projection-levers";
import { MIN_PAR_MOITIE, mesurerStabilite } from "./projection-stability";
import type { ProjectionTrade } from "./projection";

/**
 * CE QUE CES TESTS PROTÈGENT.
 *
 * Deux modules, une même règle : ne jamais présenter une moitié d'arbitrage
 * comme une solution. Réduire la taille de position fait tomber le risque de
 * ruine ET l'espérance ; comparer deux moitiés de journal trouve toujours une
 * différence. Les tests ci-dessous tiennent surtout les contreparties.
 */

const OPTIONS = { annees: 2, capitalDepart: 10_000 };

function journal(n: number, pnl: (i: number) => number, jours = 400): ProjectionTrade[] {
  const pas = (jours * 86_400_000) / Math.max(1, n - 1);
  return Array.from({ length: n }, (_, i) => ({
    open_time: new Date(Date.UTC(2025, 0, 1) + i * pas).toISOString(),
    netPnl: pnl(i),
  }));
}

/** Espérance positive mais très volatile : gagne en moyenne, explose souvent. */
const VOLATILE = (i: number) => (i % 20 < 11 ? 900 : -1000);

describe("réduire la taille coupe dans les deux sens", () => {
  it("le risque de ruine baisse quand la taille baisse", () => {
    const p = paliersDeTaille(journal(200, VOLATILE), { annees: 2, capitalDepart: 3000 });
    for (let i = 1; i < p.length; i++) {
      expect(p[i].risqueDeRuine).toBeLessThanOrEqual(p[i - 1].risqueDeRuine);
    }
  });

  it("mais l'espérance baisse EXACTEMENT dans la même proportion", () => {
    // ⚠️ LA CONTREPARTIE, ET C'EST TOUT LE POINT DU MODULE. N'afficher que la
    // chute du risque de ruine vendrait une solution miracle. Diviser la taille
    // par deux divise aussi le gain par deux : c'est un arbitrage, pas un
    // réglage gratuit.
    const p = paliersDeTaille(journal(200, VOLATILE), OPTIONS);
    const plein = p.find((x) => x.facteur === 1)!;
    const moitie = p.find((x) => x.facteur === 0.5)!;
    expect(moitie.esperance).toBeCloseTo(plein.esperance / 2, 6);
  });

  it("la taille actuelle est toujours le premier palier, inchangée", () => {
    const trades = journal(200, VOLATILE);
    const p = paliersDeTaille(trades, OPTIONS);
    expect(p[0].facteur).toBe(1);
    const moyenne = trades.reduce((s, t) => s + t.netPnl, 0) / trades.length;
    expect(p[0].esperance).toBeCloseTo(moyenne, 6);
  });

  it("on ne propose JAMAIS d'augmenter la taille", () => {
    // ⚠️ Le calcul marcherait, et ce serait informatif. Mais suggérer d'augmenter
    // la taille à quelqu'un dont l'espérance est positive revient à lui suggérer
    // de prendre plus de risque, et ce n'est pas notre métier.
    for (const p of paliersDeTaille(journal(200, VOLATILE), OPTIONS)) {
      expect(p.facteur).toBeLessThanOrEqual(1);
    }
  });

  it("un journal trop court ne produit aucun palier", () => {
    expect(paliersDeTaille(journal(40, VOLATILE), OPTIONS)).toHaveLength(0);
  });
});

describe("réduire la taille ne crée jamais d'edge", () => {
  it("une espérance négative le reste à toutes les tailles", () => {
    // ⚠️ LE DÉFAUT VU EN PRÉVISUALISATION, ET C'EST MOI QUI L'AVAIS INTRODUIT.
    // Sur un trader a espérance négative, la ligne « divisée par 5 » affichait
    // un risque de ruine de 0 % EN VERT à côté d'une espérance de -19 $. Le vert
    // disait « tu es sauvé » quand la lecture juste était « tu vas saigner
    // lentement au lieu d'exploser vite ».
    //
    // Le module ne peut pas empêcher une interface de mal colorer, mais il peut
    // rendre le fait indiscutable : le signe de l'espérance ne change JAMAIS.
    const perdant = journal(200, (i) => (i % 10 < 3 ? 500 : -250));
    const paliers = paliersDeTaille(perdant, OPTIONS);
    expect(paliers[0].esperance).toBeLessThan(0);
    for (const p of paliers) {
      expect(p.esperance, `facteur ${p.facteur}`).toBeLessThan(0);
      expect(p.median, `facteur ${p.facteur}`).toBeLessThan(0);
    }
  });

  it("le risque de ruine peut tomber à zéro alors que le trader perd encore", () => {
    // C'est précisément ce qui rendait le tableau trompeur : les deux chiffres
    // sont justes et racontent des histoires opposées. L'interface DOIT dire
    // laquelle prime.
    const perdant = journal(200, (i) => (i % 10 < 3 ? 500 : -250));
    const petit = paliersDeTaille(perdant, { annees: 2, capitalDepart: 500_000 }).at(-1)!;
    expect(petit.risqueDeRuine).toBe(0);
    expect(petit.esperance).toBeLessThan(0);
  });
});

describe("« jusqu'où descendre » est une question, pas une recommandation", () => {
  it("rend le plus GRAND palier qui passe sous le seuil", () => {
    const paliers = [
      { facteur: 1, risqueDeRuine: 0.8, esperance: 10, median: 0, partGagnante: 0.2 },
      { facteur: 0.5, risqueDeRuine: 0.15, esperance: 5, median: 0, partGagnante: 0.5 },
      { facteur: 0.2, risqueDeRuine: 0.01, esperance: 2, median: 0, partGagnante: 0.6 },
    ];
    // À 20 % de tolérance, inutile de descendre à 0,2 : 0,5 suffit et garde plus
    // d'espérance. Rendre le palier le plus prudent serait un mauvais conseil
    // déguisé en prudence.
    expect(palierSousLeSeuil(paliers, 0.2)!.facteur).toBe(0.5);
  });

  it("rend null quand aucun palier ne descend assez bas", () => {
    // ⚠️ Proposer le moins pire comme s'il réglait le problème serait mentir.
    // Quand réduire la taille ne suffit pas, le levier est ailleurs.
    const paliers = [
      { facteur: 1, risqueDeRuine: 0.9, esperance: 10, median: 0, partGagnante: 0.1 },
      { facteur: 0.2, risqueDeRuine: 0.6, esperance: 2, median: 0, partGagnante: 0.3 },
    ];
    expect(palierSousLeSeuil(paliers, 0.2)).toBeNull();
  });
});

describe("la projection vérifie sa propre hypothèse", () => {
  it("un journal stable ne signale aucun changement", () => {
    const s = mesurerStabilite(journal(200, (i) => (i % 3 === 0 ? -80 : 60)));
    expect(s.aChange).toBe(false);
    expect(s.sens).toBeNull();
  });

  it("un trader qui s'est nettement amélioré est signalé comme tel", () => {
    // Première moitié franchement perdante, seconde franchement gagnante, avec
    // peu de dispersion : les intervalles ne peuvent pas se recouvrir.
    const s = mesurerStabilite(journal(200, (i) => (i < 100 ? -100 : 100)));
    expect(s.aChange).toBe(true);
    expect(s.sens).toBe("amelioration");
    expect(s.ancienne!.esperance).toBeLessThan(0);
    expect(s.recente!.esperance).toBeGreaterThan(0);
  });

  it("et une dégradation aussi", () => {
    const s = mesurerStabilite(journal(200, (i) => (i < 100 ? 100 : -100)));
    expect(s.aChange).toBe(true);
    expect(s.sens).toBe("degradation");
  });

  it("une différence noyée dans le bruit n'est PAS signalée", () => {
    // ⚠️ LE GARDE-FOU. Deux moitiés d'un petit échantillon ont presque toujours
    // des moyennes différentes. Signaler chaque écart ferait dire à l'outil
    // « tu progresses » un mois sur deux, au hasard, et il perdrait tout crédit.
    const s = mesurerStabilite(journal(200, (i) => (i < 100 ? -1000 : 1000) * (i % 2 === 0 ? 1 : -0.99)));
    expect(s.aChange).toBe(false);
  });

  it("la coupe se fait dans l'ordre chronologique, pas dans l'ordre reçu", () => {
    // ⚠️ L'appelant reçoit souvent ses trades triés par identifiant. Couper un
    // ordre arbitraire comparerait deux échantillons aléatoires du même journal,
    // ne montrerait jamais rien, et donnerait l'illusion d'une stabilité
    // rassurante.
    const chronologique = journal(200, (i) => (i < 100 ? -100 : 100));
    const melange = [...chronologique].reverse();
    expect(mesurerStabilite(melange).sens).toBe("amelioration");
  });

  it("un journal trop court pour deux moitiés ne conclut rien", () => {
    const s = mesurerStabilite(journal(MIN_PAR_MOITIE * 2 - 1, VOLATILE));
    expect(s.ancienne).toBeNull();
    expect(s.recente).toBeNull();
    expect(s.aChange).toBe(false);
  });

  it("chaque moitié porte son intervalle, jamais sa moyenne seule", () => {
    const s = mesurerStabilite(journal(200, VOLATILE));
    for (const m of [s.ancienne!, s.recente!]) {
      expect(m.basse).toBeLessThanOrEqual(m.esperance);
      expect(m.esperance).toBeLessThanOrEqual(m.haute);
    }
  });
});
