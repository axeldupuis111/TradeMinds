import { describe, expect, it } from "vitest";
import {
  MIN_TRADES,
  courbePourGraphique,
  ecartTypePnl,
  projeter,
  tradesParAn,
  tradesPourConclure,
  type ProjectionTrade,
} from "./projection";

/**
 * CE QUE CES TESTS PROTÈGENT.
 *
 * Un moteur de projection faux est pire qu'absent : il rend un chiffre crédible
 * à quelqu'un qui va y jouer son argent. Les tests ci-dessous ne vérifient donc
 * pas seulement que le calcul tourne, ils vérifient que l'outil REFUSE de
 * conclure quand il le doit, qu'il ne change pas d'avis d'un appel à l'autre, et
 * qu'une méthode perdante ressort perdante.
 */

/** Journal fabriqué, reproductible : même graine, même journal. */
function journal(
  n: number,
  tirage: (alea: () => number, i: number) => number,
  graine = 12345,
  joursEtendue = 365,
): ProjectionTrade[] {
  let a = graine >>> 0;
  const alea = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const depart = Date.UTC(2025, 0, 1);
  const pas = (joursEtendue * 86_400_000) / Math.max(1, n - 1);
  return Array.from({ length: n }, (_, i) => ({
    open_time: new Date(depart + i * pas).toISOString(),
    netPnl: tirage(alea, i),
  }));
}

/** Gagnante nettement : +100 six fois sur dix, -80 sinon. Espérance +28. */
const GAGNANTE = (alea: () => number) => (alea() < 0.6 ? 100 : -80);
/** Perdante nettement : +100 trois fois sur dix, -80 sinon. Espérance -26. */
const PERDANTE = (alea: () => number) => (alea() < 0.3 ? 100 : -80);
/** Pile ou face pur, gain et perte symétriques. Espérance nulle. */
const NEUTRE = (alea: () => number) => (alea() < 0.5 ? 100 : -100);

const OPTIONS = { annees: 2, capitalDepart: 10_000 };

describe("le seuil de conclusion est une décision de produit, pas un réglage", () => {
  it("MIN_TRADES vaut 100", () => {
    // ⚠️ CE TEST EXISTE POUR RENDRE UNE BAISSE IMPOSSIBLE À FAIRE EN SILENCE.
    //
    // Baisser ce seuil est la modification la plus tentante du fichier : elle
    // remplit l'onglet pour beaucoup plus de traders, immédiatement. C'est
    // aussi la plus destructrice, parce qu'elle transforme l'outil en machine à
    // rassurer des gens dont les chiffres ne prouvent rien.
    //
    // Il y a UNE raison légitime de le baisser : regarder la page en
    // prévisualisation quand on n'a pas assez de trades pour la remplir. Dans
    // ce cas ce test passe au rouge, et c'est exactement ce qu'on veut : la
    // suite entière annonce que la branche n'est pas mergeable telle quelle.
    expect(MIN_TRADES).toBe(100);
  });
});

describe("l'outil refuse de conclure quand il le doit", () => {
  it("sous le seuil, il dit combien il manque au lieu de sortir un chiffre", () => {
    const p = projeter(journal(40, GAGNANTE), OPTIONS);
    expect(p.verdict).toBe("insuffisant");
    expect(p.trades).toBe(40);
    expect(p.tradesManquants).toBe(MIN_TRADES - 40);
  });

  it("aucun résultat de simulation ne fuit sous le seuil", () => {
    // ⚠️ LA PROPRIÉTÉ QUI COMPTE. Simuler puis masquer laisserait le chiffre à
    // portée du premier composant qui lirait l'objet, et il finirait affiché.
    // Ce qui n'existe pas ne peut pas fuir.
    const p = projeter(journal(40, GAGNANTE), OPTIONS);
    expect(p.median).toBe(0);
    expect(p.p05).toBe(0);
    expect(p.p95).toBe(0);
    expect(p.risqueDeRuine).toBe(0);
    expect(p.courbe).toHaveLength(0);
  });

  it("un journal vide ne fait pas exploser le moteur", () => {
    const p = projeter([], OPTIONS);
    expect(p.verdict).toBe("insuffisant");
    expect(p.trades).toBe(0);
    expect(p.tradesManquants).toBe(MIN_TRADES);
    expect(Number.isFinite(p.esperance)).toBe(true);
  });

  it("assez de trades mais tous le même jour : pas de rythme, pas de verdict", () => {
    // Deux cents trades en une heure ne disent rien du rythme annuel. Extrapoler
    // cette pointe donnerait des dizaines de milliers de trades par an, et une
    // projection délirante dans les deux sens.
    const memeJour = journal(200, GAGNANTE, 7, 0);
    expect(projeter(memeJour, OPTIONS).verdict).toBe("insuffisant");
  });
});

describe("le verdict suit ce que les chiffres démontrent, pas ce qu'ils suggèrent", () => {
  it("une méthode nettement gagnante ressort rentable", () => {
    const p = projeter(journal(400, GAGNANTE), OPTIONS);
    expect(p.verdict).toBe("rentable");
    expect(p.esperanceBasse).toBeGreaterThan(0);
    expect(p.median).toBeGreaterThan(0);
  });

  it("une méthode nettement perdante ressort perdante", () => {
    const p = projeter(journal(400, PERDANTE), OPTIONS);
    expect(p.verdict).toBe("perdante");
    expect(p.esperanceHaute).toBeLessThan(0);
    expect(p.median).toBeLessThan(0);
  });

  it("un pile ou face reste indéterminé, il ne devient pas une opinion", () => {
    // ⚠️ LE CAS LE PLUS IMPORTANT DES TROIS. C'est celui de la majorité des
    // traders : une espérance légèrement positive ou négative, noyée dans le
    // bruit. L'outil doit dire « on ne sait pas », jamais arrondir vers
    // l'encourageant.
    const p = projeter(journal(400, NEUTRE), OPTIONS);
    expect(p.verdict).toBe("indetermine");
    expect(p.esperanceBasse).toBeLessThan(0);
    expect(p.esperanceHaute).toBeGreaterThan(0);
  });

  it("l'intervalle encadre toujours l'espérance", () => {
    for (const tirage of [GAGNANTE, PERDANTE, NEUTRE]) {
      const p = projeter(journal(300, tirage), OPTIONS);
      expect(p.esperanceBasse).toBeLessThanOrEqual(p.esperance);
      expect(p.esperance).toBeLessThanOrEqual(p.esperanceHaute);
    }
  });
});

describe("le même journal donne toujours les mêmes nombres", () => {
  it("deux appels identiques rendent un résultat identique", () => {
    // ⚠️ SANS CETTE PROPRIÉTÉ, L'OUTIL N'A AUCUNE VALEUR. Un trader qui voit
    // « 23 % de risque de ruine » puis « 19 % » sur le même journal en retient
    // une seule chose : que l'outil invente.
    const j = journal(300, GAGNANTE);
    expect(JSON.stringify(projeter(j, OPTIONS))).toBe(JSON.stringify(projeter(j, OPTIONS)));
  });

  it("un trade de plus fait bouger le résultat", () => {
    // L'inverse du test précédent : déterministe ne veut pas dire figé. Si
    // ajouter un trade ne changeait rien, la graine ne dépendrait pas des
    // données et le déterminisme serait un accident.
    const j = journal(300, GAGNANTE);
    const jPlusUn = [...j, { open_time: "2026-01-15T10:00:00.000Z", netPnl: -500 }];
    expect(projeter(jPlusUn, OPTIONS).median).not.toBe(projeter(j, OPTIONS).median);
  });
});

describe("le risque est mesuré sur ce qui arrive vraiment aux traders", () => {
  it("les centiles sont ordonnés", () => {
    const p = projeter(journal(300, GAGNANTE), OPTIONS);
    expect(p.p05).toBeLessThanOrEqual(p.p25);
    expect(p.p25).toBeLessThanOrEqual(p.median);
    expect(p.median).toBeLessThanOrEqual(p.p75);
    expect(p.p75).toBeLessThanOrEqual(p.p95);
  });

  it("les creux sont toujours négatifs ou nuls, et le pire est le plus profond", () => {
    const p = projeter(journal(300, GAGNANTE), OPTIONS);
    expect(p.drawdownMedian).toBeLessThanOrEqual(0);
    expect(p.drawdownPire).toBeLessThanOrEqual(p.drawdownMedian);
  });

  it("une méthode perdante finit par ruiner presque tout le monde", () => {
    const p = projeter(journal(300, PERDANTE), { ...OPTIONS, annees: 5 });
    expect(p.risqueDeRuine).toBeGreaterThan(0.9);
    expect(p.partGagnante).toBeLessThan(0.1);
  });

  it("même gagnante, une méthode peut ruiner : le risque n'est jamais nul par principe", () => {
    // Espérance positive mais volatilité énorme et capital serré : le trader
    // gagne en moyenne et explose souvent. C'est précisément le cas que
    // l'espérance seule ne montre pas, et toute la raison d'être de la
    // simulation.
    // ⚠️ Motif DÉTERMINISTE et non un tirage à 55 % : mon premier jet tirait au
    // hasard, l'échantillon est sorti sous la pièce et l'espérance était
    // négative. Un test qui dépend de la chance de son propre tirage teste la
    // chance. Ici, 11 gains de 900 pour 9 pertes de 1 000 par tranche de 20,
    // soit +45 par trade, sans discussion possible.
    const volatile = journal(300, (_alea, i) => (i % 20 < 11 ? 900 : -1000));
    const p = projeter(volatile, { annees: 2, capitalDepart: 2000 });
    expect(p.esperance).toBeGreaterThan(0);
    expect(p.risqueDeRuine).toBeGreaterThan(0.5);
  });

  it("les blocs conservent les séries, donc ne sous-estiment pas la ruine", () => {
    // ⚠️ LA DÉCISION DE CONCEPTION QUE CE TEST TIENT. Un journal en dents de
    // scie longues (dix gains d'affilée, puis dix pertes) contient des séries
    // que le tirage trade par trade détruit. Avec des blocs de 1, les pertes se
    // dispersent et les vrais creux disparaissent du modèle.
    const enSeries = journal(300, (_alea, i) => (Math.floor(i / 10) % 2 === 0 ? 100 : -95));
    const parBlocs = projeter(enSeries, { ...OPTIONS, capitalDepart: 1500, tailleBloc: 10 });
    const parTrade = projeter(enSeries, { ...OPTIONS, capitalDepart: 1500, tailleBloc: 1 });
    expect(parBlocs.drawdownMedian).toBeLessThan(parTrade.drawdownMedian);
    expect(parBlocs.risqueDeRuine).toBeGreaterThanOrEqual(parTrade.risqueDeRuine);
  });
});

describe("le rythme est mesuré sur l'étendue, pas sur la pointe", () => {
  it("200 trades sur un an font environ 200 trades par an", () => {
    const r = tradesParAn(journal(200, GAGNANTE, 1, 365));
    expect(r).toBeGreaterThan(180);
    expect(r).toBeLessThan(220);
  });

  it("une rafale suivie d'un long silence n'est pas extrapolée", () => {
    // 100 trades en dix jours, puis un dernier six mois après. Le rythme réel
    // est d'environ 100 trades sur 190 jours, pas de 10 par jour.
    const rafale = journal(100, GAGNANTE, 3, 10);
    rafale.push({ open_time: "2025-07-10T10:00:00.000Z", netPnl: 50 });
    const r = tradesParAn(rafale);
    expect(r).toBeLessThan(400);
  });

  it("un seul trade ne permet pas de mesurer un rythme", () => {
    expect(tradesParAn([{ open_time: "2025-01-01T00:00:00.000Z", netPnl: 10 }])).toBe(0);
  });
});

describe("« il te manque N trades » est le chiffre le plus utile de l'onglet", () => {
  it("il croît quand l'edge est petit devant le bruit", () => {
    const petitEdge = tradesPourConclure(5, 100);
    const grosEdge = tradesPourConclure(50, 100);
    expect(petitEdge).not.toBeNull();
    expect(grosEdge).not.toBeNull();
    expect(petitEdge!).toBeGreaterThan(grosEdge!);
  });

  it("aucun nombre de trades ne sauve une espérance nulle ou négative", () => {
    // Répondre « il t'en faut 4 000 » à quelqu'un qui perd serait l'inviter à
    // continuer pour le prouver. On répond null, et l'interface dit autre chose.
    expect(tradesPourConclure(0, 100)).toBeNull();
    expect(tradesPourConclure(-12, 100)).toBeNull();
  });

  it("il se raccorde au moteur : sous le seuil, l'écart-type reste calculable", () => {
    const j = journal(40, GAGNANTE);
    const sigma = ecartTypePnl(j);
    expect(sigma).toBeGreaterThan(0);
    expect(tradesPourConclure(projeter(j, OPTIONS).esperance, sigma)).not.toBeNull();
  });
});

describe("la courbe est lisible quel que soit l'horizon", () => {
  it("les mois avancent et le dernier point correspond à l'horizon", () => {
    const p = projeter(journal(300, GAGNANTE), { ...OPTIONS, annees: 5 });
    expect(p.courbe.length).toBeGreaterThan(1);
    for (let i = 1; i < p.courbe.length; i++) {
      expect(p.courbe[i].mois).toBeGreaterThanOrEqual(p.courbe[i - 1].mois);
    }
    const dernier = p.courbe[p.courbe.length - 1];
    expect(dernier.mois).toBeGreaterThan(55);
    expect(dernier.mois).toBeLessThan(65);
  });

  it("un horizon de quinze ans ne rend pas un tableau ingérable", () => {
    const p = projeter(journal(300, GAGNANTE), { ...OPTIONS, annees: 15 });
    expect(p.courbe.length).toBeLessThanOrEqual(181);
  });

  it("le dernier point de la courbe médiane rejoint la médiane finale", () => {
    const p = projeter(journal(300, GAGNANTE), OPTIONS);
    const dernier = p.courbe[p.courbe.length - 1];
    expect(Math.abs(dernier.median - p.median)).toBeLessThan(Math.abs(p.median) * 0.02 + 1);
  });

  it("les bandes de la courbe sont ordonnées à chaque point", () => {
    const p = projeter(journal(300, NEUTRE), OPTIONS);
    for (const pt of p.courbe) {
      expect(pt.p05).toBeLessThanOrEqual(pt.p25);
      expect(pt.p25).toBeLessThanOrEqual(pt.median);
      expect(pt.median).toBeLessThanOrEqual(pt.p75);
      expect(pt.p75).toBeLessThanOrEqual(pt.p95);
    }
  });
});

describe("la mise en forme du graphique tient même quand la bande traverse zéro", () => {
  it("chaque point rend deux intervalles [bas, haut] ordonnés", () => {
    const points = courbePourGraphique(projeter(journal(300, NEUTRE), OPTIONS).courbe);
    expect(points.length).toBeGreaterThan(1);
    for (const p of points) {
      expect(p.bande90[0]).toBeLessThanOrEqual(p.bande90[1]);
      expect(p.bande50[0]).toBeLessThanOrEqual(p.bande50[1]);
      // La moitié centrale est contenue dans la bande à 90 %, toujours.
      expect(p.bande90[0]).toBeLessThanOrEqual(p.bande50[0]);
      expect(p.bande50[1]).toBeLessThanOrEqual(p.bande90[1]);
      expect(Number.isFinite(p.median)).toBe(true);
    }
  });

  it("le cas qui a motivé la fonction : une bande à cheval sur zéro", () => {
    // ⚠️ LE DÉFAUT QU'ON ÉVITE ICI. Empiler une base et des épaisseurs se
    // disloque quand le bas est négatif et le haut positif, parce que les
    // bibliothèques de graphiques empilent les négatifs à part. Or c'est le cas
    // le plus fréquent de la page. On vérifie donc qu'il EXISTE dans un journal
    // neutre, et que la mise en forme le rend tel quel.
    const points = courbePourGraphique(projeter(journal(300, NEUTRE), OPTIONS).courbe);
    const aChevalSurZero = points.filter((p) => p.bande90[0] < 0 && p.bande90[1] > 0);
    expect(aChevalSurZero.length).toBeGreaterThan(0);
    for (const p of aChevalSurZero) {
      expect(p.bande90[1] - p.bande90[0]).toBeGreaterThan(0);
    }
  });

  it("une courbe vide ne rend rien, pas un point vide", () => {
    expect(courbePourGraphique([])).toEqual([]);
  });
});
