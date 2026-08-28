import { describe, expect, it } from "vitest";
import { MAX_TENTATIVES_AVANT_ALERTE, MIN_TRADES_CONCLUSION, lireBacktest } from "./verdict";
import type { Couts, ResultatBacktest, TradeSimule } from "./types";

const SANS_COUT: Couts = { spreadTicks: 0, glissementTicks: 0, commissionTicks: 0 };

function trade(r: number, over: Partial<TradeSimule> = {}): TradeSimule {
  return {
    signalMs: 0,
    niveauSignal: 1000,
    entreeMs: 0,
    sortieMs: 0,
    sens: "long",
    entreeTicks: 1000,
    sortieTicks: 1000,
    risqueTicks: 100,
    r,
    rBrut: r,
    motif: r > 0 ? "objectif" : "stop",
    collisionMemeBarre: false,
    ...over,
  };
}

/**
 * Résultat fabriqué : `gagnants` trades à +gainR, `perdants` à -1R.
 *
 * ⚠️ Les gagnants sont RÉPARTIS régulièrement, jamais empilés au début. Un
 * fixture qui range tous les gains d'un côté fabrique un effondrement hors
 * échantillon qui n'existe pas, et le test qui le détecte croit alors mesurer
 * le code alors qu'il mesure l'ordre du tableau.
 */
function resultat(gagnants: number, perdants: number, gainR = 2, over: Partial<TradeSimule> = {}): ResultatBacktest {
  const n = gagnants + perdants;
  const trades: TradeSimule[] = [];
  for (let i = 0; i < n; i++) {
    const gagnant = Math.floor(((i + 1) * gagnants) / n) > Math.floor((i * gagnants) / n);
    trades.push(trade(gagnant ? gainR : -1, over));
  }
  return {
    trades,
    audit: {
      bougies: 0,
      signaux: trades.length,
      refusesParGestion: 0,
      limitesExpirees: 0,
      refusesRisqueTropPetit: 0,
      journeesArretees: 0,
      barresAvecNiveau: 0,
      refusesParFiltre: {},
      droitesTracees: 0,
      droitesConfirmees: 0,
      collisions: 0,
      coutTotalR: 0,
    },
    debutMs: 0,
    finMs: 0,
  };
}

describe("règle 1 : sous le seuil, aucun chiffre n'est calculé", () => {
  it("ne rend ni stats ni coûts, seulement ce qu'il manque", () => {
    const lecture = lireBacktest(resultat(30, 69), SANS_COUT);
    expect(lecture.verdict).toBe("insuffisant");
    expect(lecture.tradesManquants).toBe(1);
    // Pas « calculé puis masqué » : le champ n'existe pas. Un chiffre présent
    // dans l'objet finit toujours par être affiché par quelqu'un.
    expect(lecture.stats).toBeUndefined();
    expect(lecture.couts).toBeUndefined();
    expect(lecture.horsEchantillon).toBeUndefined();
  });

  it("conclut dès le seuil atteint", () => {
    expect(lireBacktest(resultat(30, 70), SANS_COUT).verdict).not.toBe("insuffisant");
    expect(MIN_TRADES_CONCLUSION).toBe(100);
  });
});

describe("règle 3 : le vert exige que zéro soit hors de l'intervalle", () => {
  it("dit « on ne peut pas conclure » sur les chiffres publiés de l'outil qui a inspiré celui-ci", () => {
    // 408 trades, 34,07 % de réussite, objectif fixe à 2R : c'est exactement la
    // capture d'écran qui a lancé ce chantier. Espérance +0,0221R, profit
    // factor 1,0335, total +9,0R, et l'outil d'origine affichait tout ça en
    // vert. L'intervalle à 95 % va de -0,116 à +0,160 : il contient zéro, donc
    // ces 408 trades ne démontrent RIEN. C'est le chiffre qui manquait.
    const lecture = lireBacktest(resultat(139, 269), SANS_COUT);

    expect(lecture.stats!.nbTrades).toBe(408);
    expect(lecture.stats!.tauxReussite).toBeCloseTo(0.3407, 4);
    expect(lecture.stats!.esperanceR).toBeCloseTo(0.0221, 4);
    expect(lecture.stats!.profitFactor).toBeCloseTo(1.0335, 4);
    expect(lecture.stats!.totalR).toBeCloseTo(9, 6);

    expect(lecture.stats!.borneBasse).toBeLessThan(0);
    expect(lecture.stats!.borneHaute).toBeGreaterThan(0);
    expect(lecture.verdict).toBe("non_concluant");
  });

  it("ne dit « positif » que si la borne basse dépasse zéro", () => {
    // 400 trades à 50 % de réussite pour un objectif de 2R : espérance +0,5R,
    // intervalle [+0,35 ; +0,65]. Là, on peut le dire.
    const lecture = lireBacktest(resultat(200, 200), SANS_COUT);
    expect(lecture.stats!.borneBasse).toBeGreaterThan(0);
    expect(lecture.verdict).toBe("positif");
  });

  it("dit « négatif » quand la borne haute reste sous zéro", () => {
    // 200 trades à 20 % : espérance -0,4R, intervalle [-0,57 ; -0,23].
    const lecture = lireBacktest(resultat(40, 160), SANS_COUT);
    expect(lecture.stats!.borneHaute).toBeLessThan(0);
    expect(lecture.verdict).toBe("negatif");
  });

  it("une espérance positive ne suffit pas quand la dispersion l'avale", () => {
    // Espérance +0,0221R comme plus haut, mais on vérifie explicitement que le
    // signe de la moyenne ne pilote PAS le verdict.
    const lecture = lireBacktest(resultat(139, 269), SANS_COUT);
    expect(lecture.stats!.esperanceR).toBeGreaterThan(0);
    expect(lecture.verdict).not.toBe("positif");
  });
});

describe("audit des coûts", () => {
  it("sépare l'espérance brute de la nette et chiffre ce que le coût a pris", () => {
    const r = resultat(139, 269);
    // On rejoue les mêmes trades en amputant chacun de 0,05R de frais.
    r.trades = r.trades.map((t) => ({ ...t, r: t.r - 0.05 }));

    const lecture = lireBacktest(r, { spreadTicks: 20, glissementTicks: 2, commissionTicks: 6 });
    expect(lecture.couts!.esperanceBruteR).toBeCloseTo(0.0221, 4);
    expect(lecture.couts!.esperanceNetteR).toBeCloseTo(-0.0279, 4);
    expect(lecture.couts!.coutParTradeR).toBeCloseTo(0.05, 6);
    // Gagnante en brut, perdante une fois payée : c'est le cas qu'un backtest à
    // coûts nuls présente en vert.
    expect(lecture.couts!.edgeDetruitParLesCouts).toBe(true);
    // 20 + 2 x 2 + 6 = 30 ticks d'aller-retour.
    expect(lecture.couts!.coutApplique).toBe(30);
  });

  it("chiffre le coût supplémentaire qui suffirait à annuler l'avantage", () => {
    // Espérance +0,0221R sur un risque moyen de 176 ticks : 3,9 ticks de plus
    // par aller-retour et il ne reste rien. À comparer au spread réel.
    const lecture = lireBacktest(resultat(139, 269, 2, { risqueTicks: 176 }), SANS_COUT);
    expect(lecture.couts!.risqueMoyenTicks).toBe(176);
    expect(lecture.couts!.coutBreakEvenTicks).toBeCloseTo(3.88, 2);
  });

  it("ne crie pas au coût quand la méthode perd déjà en brut", () => {
    const lecture = lireBacktest(resultat(40, 160), SANS_COUT);
    expect(lecture.couts!.edgeDetruitParLesCouts).toBe(false);
  });
});

describe("contrôle hors échantillon", () => {
  it("signale un avantage qui ne survit pas à la dernière période", () => {
    // Ici l'ordre est VOULU : 280 gagnants puis 120 perdants. La coupe à 70 %
    // laisse une première partie gagnante et une fin franchement perdante,
    // c'est la forme exacte d'une méthode qui a cessé de fonctionner.
    const r = resultat(0, 0);
    r.trades = [
      ...Array.from({ length: 280 }, () => trade(2)),
      ...Array.from({ length: 120 }, () => trade(-1)),
    ];
    const lecture = lireBacktest(r, SANS_COUT);
    expect(lecture.horsEchantillon!.applicable).toBe(true);
    expect(lecture.horsEchantillon!.esperanceDebutR).toBeGreaterThan(0);
    expect(lecture.horsEchantillon!.esperanceFinR).toBeLessThan(0);
    expect(lecture.horsEchantillon!.neSurvitPas).toBe(true);
  });

  it("ne signale rien quand les deux moitiés vont dans le même sens", () => {
    const lecture = lireBacktest(resultat(200, 200), SANS_COUT);
    expect(lecture.horsEchantillon!.neSurvitPas).toBe(false);
  });
});

describe("sur-apprentissage et collisions", () => {
  it("alerte au-delà du nombre de rejeux toléré", () => {
    const r = resultat(139, 269);
    expect(lireBacktest(r, SANS_COUT, MAX_TENTATIVES_AVANT_ALERTE).risqueDeSurApprentissage).toBe(false);
    expect(lireBacktest(r, SANS_COUT, MAX_TENTATIVES_AVANT_ALERTE + 1).risqueDeSurApprentissage).toBe(true);
  });

  it("alerte même quand il n'y a pas assez de trades pour conclure", () => {
    // Le sur-apprentissage se juge sur le nombre de rejeux, pas sur le résultat :
    // il doit rester visible sur un test qui ne conclut pas.
    const lecture = lireBacktest(resultat(10, 10), SANS_COUT, 50);
    expect(lecture.verdict).toBe("insuffisant");
    expect(lecture.risqueDeSurApprentissage).toBe(true);
  });

  it("publie la part de trades tranchés par la convention de collision", () => {
    const r = resultat(139, 269);
    r.audit.collisions = 102;
    expect(lireBacktest(r, SANS_COUT).partCollisions).toBeCloseTo(0.25, 6);
  });
});

describe("diagnostic d'un résultat vide", () => {
  /** Un résultat sans trade, avec l'audit qu'on veut examiner. */
  function vide(audit: Partial<ResultatBacktest["audit"]>): ResultatBacktest {
    const r = resultat(0, 0);
    r.audit = { ...r.audit, bougies: 10_000, signaux: 0, ...audit };
    return r;
  }

  it("distingue un niveau qui n'a jamais existé d'un signal jamais venu", () => {
    // ⚠️ Ces deux causes donnent le même zéro à l'écran et appellent des gestes
    // OPPOSÉS : régler le bloc niveau, ou constater que la méthode ne se
    // déclenche pas. Les confondre envoie le trader au mauvais endroit.
    expect(lireBacktest(vide({ barresAvecNiveau: 0 }), SANS_COUT).cause).toBe("aucun_niveau");
    expect(lireBacktest(vide({ barresAvecNiveau: 9_000 }), SANS_COUT).cause).toBe("aucun_signal");
  });

  it("distingue une tolérance trop stricte d'une largeur de pivot trop grande", () => {
    // ⚠️ Deux causes derrière le même zéro, qui envoient vers deux réglages
    // OPPOSÉS. Mesuré en vrai sur quatre ans de Nasdaq : une largeur de pivot
    // de 240 bougies H1 ne produit qu'une droite toutes les 435 bougies, une
    // largeur de 8 en produit une toutes les 13. Les deux donnaient zéro trade.
    const rares = vide({ bougies: 23_489, barresAvecNiveau: 0, droitesTracees: 54 });
    expect(lireBacktest(rares, SANS_COUT).cause).toBe("droites_trop_rares");

    const nombreuses = vide({ bougies: 23_489, barresAvecNiveau: 0, droitesTracees: 1_824 });
    expect(lireBacktest(nombreuses, SANS_COUT).cause).toBe("aucune_droite_confirmee");
  });

  it("reconnaît des signaux tous écartés faute de stop assez large", () => {
    const r = vide({ barresAvecNiveau: 9_000, signaux: 0, refusesRisqueTropPetit: 120 });
    expect(lireBacktest(r, SANS_COUT).cause).toBe("tout_ecarte");
  });

  it("dit simplement « trop peu » quand la méthode se déclenche", () => {
    const r = resultat(20, 30);
    r.audit = { ...r.audit, bougies: 10_000, barresAvecNiveau: 9_000, signaux: 60 };
    expect(lireBacktest(r, SANS_COUT).cause).toBe("trop_peu");
  });

  it("ne rend aucune cause quand le verdict conclut", () => {
    expect(lireBacktest(resultat(139, 269), SANS_COUT).cause).toBeUndefined();
  });
});
