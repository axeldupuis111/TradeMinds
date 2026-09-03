import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifierLePlan, type CodeConstat, type FicheConfrontable } from "./coherence-plan";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import fr from "../i18n/fr";
import type { AuditExecution, PlanExecution, TradeSimule } from "./types";
import type { Statistiques } from "./verdict";

const NAS = instrumentParCode("NAS100")!;

function plan(partiel: Partial<PlanExecution> = {}): PlanExecution {
  return {
    ...socleDePlan("NAS100", "Europe/Paris"),
    uniteDeTemps: 5,
    contexte: { fuseau: "Europe/Paris", debut: "08:00", fin: "22:00", jours: [1, 2, 3, 4, 5] },
    niveau: { type: "liquidite_swing", pivots: 10 },
    declencheur: { type: "balayage_retour" },
    confirmations: [],
    stop: { type: "structurel", bufferTicks: 200 },
    objectif: { type: "multiple_r", r: 2 },
    gestion: {},
    couts: coutsPourInstrument(NAS),
    ...partiel,
  };
}

function audit(partiel: Partial<AuditExecution> = {}): AuditExecution {
  return {
    bougies: 100_000,
    signaux: 500,
    refusesParGestion: 10,
    limitesExpirees: 0,
    refusesRisqueTropPetit: 0,
    journeesArretees: 5,
    barresAvecNiveau: 50_000,
    refusesParFiltre: {},
    signauxSoumisAuxFiltres: 0,
    droitesTracees: 0,
    droitesConfirmees: 0,
    collisions: 0,
    coutTotalR: 0,
    ...partiel,
  };
}

/** `n` trades étalés sur `jours` jours, avec un risque donné en ticks. */
function trades(n: number, jours: number, risqueTicks = 40_000): TradeSimule[] {
  return Array.from({ length: n }, (_, i) => {
    const ms = Date.UTC(2024, 0, 1) + Math.floor((i / n) * jours) * 86_400_000;
    return {
      signalMs: ms,
      niveauSignal: 0,
      entreeMs: ms,
      sortieMs: ms + 3_600_000,
      sens: "long" as const,
      entreeTicks: 15_000_000,
      sortieTicks: 15_000_000,
      risqueTicks,
      r: 0.1,
      rBrut: 0.15,
      motif: "objectif" as const,
      collisionMemeBarre: false,
    };
  });
}

const stats = (tauxReussite: number): Statistiques => ({
  nbTrades: 400,
  tauxReussite,
  esperanceR: 0.05,
  borneBasse: -0.02,
  borneHaute: 0.12,
  totalR: 20,
  profitFactor: 1.1,
  drawdownMaxR: 10,
});

const RIEN: FicheConfrontable = {};
const codes = (c: { code: CodeConstat }[]) => c.map((x) => x.code);

describe("le marché testé est-il celui de la fiche", () => {
  /**
   * ⚠️ LE CONTRÔLE LE PLUS ÉLÉMENTAIRE, et personne ne le fait : un résultat
   * mesuré sur le Nasdaq ne dit rien d'une méthode écrite pour l'or.
   */
  it("signale un instrument absent des paires de la fiche", () => {
    const c = verifierLePlan(plan(), audit(), trades(200, 60), NAS, {
      pairs: ["XAUUSD", "EURUSD"],
    });
    expect(codes(c)).toContain("instrument_hors_fiche");
    expect(c.find((x) => x.code === "instrument_hors_fiche")!.gravite).toBe("bloquant");
  });

  it("ne dit rien quand la fiche cite bien l'instrument", () => {
    const c = verifierLePlan(plan(), audit(), trades(200, 60), NAS, { pairs: ["NAS100"] });
    expect(codes(c)).not.toContain("instrument_hors_fiche");
  });

  it("reconnaît une écriture voisine de la même paire", () => {
    for (const ecriture of ["nas100", "NAS 100", "US100 / NAS100"]) {
      const c = verifierLePlan(plan(), audit(), trades(200, 60), NAS, { pairs: [ecriture] });
      expect(codes(c), ecriture).not.toContain("instrument_hors_fiche");
    }
  });

  it("ne dit rien quand la fiche ne cite aucune paire", () => {
    expect(codes(verifierLePlan(plan(), audit(), trades(200, 60), NAS, RIEN))).not.toContain(
      "instrument_hors_fiche",
    );
  });
});

describe("le rythme observé contre celui de la fiche", () => {
  /**
   * ⚠️ MESURÉ EN VRAI. Une fiche appliquée à la lettre produisait quinze trades
   * par jour ; ce n'était pas un défaut du moteur, c'est qu'elle décrivait une
   * ENTRÉE et pas une stratégie. Personne ne l'avait jamais dit à son auteur.
   */
  it("signale quinze trades par jour quand la fiche en annonce trois", () => {
    const c = verifierLePlan(plan(), audit(), trades(900, 60), NAS, { max_trades_per_day: 3 });
    expect(codes(c)).toContain("rythme_hors_fiche");
  });

  it("ne dit rien quand le rythme colle à peu près", () => {
    const c = verifierLePlan(plan(), audit(), trades(120, 60), NAS, { max_trades_per_day: 3 });
    expect(codes(c)).not.toContain("rythme_hors_fiche");
  });

  /**
   * ⚠️ Sur quelques jours, le rythme ne veut rien dire : deux journées chargées
   * suffiraient à crier au désaccord.
   */
  it("ne conclut pas sur trop peu de jours", () => {
    const c = verifierLePlan(plan(), audit(), trades(200, 5), NAS, { max_trades_per_day: 3 });
    expect(codes(c)).not.toContain("rythme_hors_fiche");
  });
});

describe("les règles qui ne s'appliquent jamais", () => {
  /**
   * ⚠️ Une règle inerte n'est pas anodine : le test s'est déroulé exactement
   * comme si elle n'existait pas, donc ce qui a été mesuré n'est pas la méthode
   * que le trader croit avoir décrite.
   */
  it("signale un filtre qui n'a jamais rien écarté", () => {
    const c = verifierLePlan(
      plan(),
      audit({ signauxSoumisAuxFiltres: 500, refusesParFiltre: { rsi: 0, macd: 120 } }),
      trades(200, 60),
      NAS,
      RIEN,
    );
    expect(codes(c)).toContain("filtre_inerte");
    expect(c.filter((x) => x.code === "filtre_inerte")).toHaveLength(1);
  });

  /**
   * ⚠️⚠️ « ZÉRO REFUS » NE SUFFISAIT PAS COMME SEUIL, et l'écran l'a montré : un
   * filtre directionnel avait écarté 4 signaux sur 498, la carte des confluences
   * disait « il ne trie rien de mesurable », et cette carte-ci disait dans le
   * même écran « aucune de tes règles n'est restée inerte ».
   */
  it("signale un filtre qui n'écarte presque rien", () => {
    const c = verifierLePlan(
      plan(),
      audit({ signauxSoumisAuxFiltres: 498, refusesParFiltre: { biais_moyenne: 4 } }),
      trades(200, 60),
      NAS,
      RIEN,
    );
    expect(codes(c)).toContain("filtre_presque_inerte");
    expect(c.find((x) => x.code === "filtre_presque_inerte")!.valeurs.part).toBe("0.8");
  });

  it("ne dit rien d'un filtre qui écarte pour de bon", () => {
    const c = verifierLePlan(
      plan(),
      audit({ signauxSoumisAuxFiltres: 498, refusesParFiltre: { biais_moyenne: 120 } }),
      trades(200, 60),
      NAS,
      RIEN,
    );
    expect(codes(c)).not.toContain("filtre_presque_inerte");
    expect(codes(c)).not.toContain("filtre_inerte");
  });

  it("ne crie pas au filtre inerte sur trop peu de signaux", () => {
    const c = verifierLePlan(
      plan(),
      audit({ signauxSoumisAuxFiltres: 7, refusesParFiltre: { rsi: 0 } }),
      trades(200, 60),
      NAS,
      RIEN,
    );
    expect(codes(c)).not.toContain("filtre_inerte");
  });

  it("signale un plafond de trades par jour jamais atteint", () => {
    const p = plan({ gestion: { maxTradesParJour: 3 } });
    const c = verifierLePlan(p, audit({ refusesParGestion: 0 }), trades(200, 60), NAS, RIEN);
    expect(codes(c)).toContain("plafond_jour_inerte");
  });

  it("signale une règle d'arrêt jamais déclenchée", () => {
    const p = plan({ gestion: { maxPertesConsecutives: 3 } });
    const c = verifierLePlan(p, audit({ journeesArretees: 0 }), trades(200, 60), NAS, RIEN);
    expect(codes(c)).toContain("arret_inerte");
  });

  it("ne signale rien quand la règle n'existe pas", () => {
    const c = verifierLePlan(plan(), audit({ refusesParGestion: 0 }), trades(200, 60), NAS, RIEN);
    expect(codes(c)).not.toContain("plafond_jour_inerte");
  });
});

describe("les coûts devant le risque", () => {
  /**
   * ⚠️ C'EST LE CHIFFRE QUI A TUÉ LA STRATÉGIE DE LA VIDÉO : 23 % du risque payé
   * à chaque aller-retour, et aucune méthode à 2R n'y survit.
   */
  it("signale un stop trop serré devant l'aller-retour", () => {
    // Coûts du Nasdaq : ~1900 ticks d'aller-retour. Un stop de 5000 ticks en
    // laisse près de 40 % sur la table.
    const c = verifierLePlan(plan(), audit(), trades(200, 60, 5000), NAS, RIEN);
    const constat = c.find((x) => x.code === "couts_lourds");
    expect(constat).toBeTruthy();
    expect(constat!.gravite).toBe("bloquant");
  });

  it("ne dit rien quand le stop est large devant les coûts", () => {
    expect(codes(verifierLePlan(plan(), audit(), trades(200, 60, 200_000), NAS, RIEN))).not.toContain(
      "couts_lourds",
    );
  });
});

/**
 * ⚠️ UNE MULTIPLICATION SUR DES R DÉJÀ MESURÉS, pas une prévision. Le trader
 * écrit « je risque 5 % » sans jamais voir ce que ça donne sur quatre ans de sa
 * propre méthode. C'est le chiffre qui décide s'il tient ou s'il arrête, et
 * personne ne le lui dit.
 */
describe("ce que le risque par trade a fait au compte", () => {
  /** Des trades qui alternent pour creuser un vrai recul. */
  function enDentsDeScie(n: number, jours: number): TradeSimule[] {
    return trades(n, jours).map((t, i) => ({ ...t, r: i < n / 2 ? -1 : 0.5 }));
  }

  it("signale un recul de compte considérable", () => {
    const p = plan({ gestion: { risqueParTradePct: 5 } });
    const c = verifierLePlan(p, audit(), enDentsDeScie(60, 60), NAS, RIEN);
    expect(codes(c)).toContain("risque_par_trade_lourd");
  });

  it("ne dit rien quand le risque reste tenable", () => {
    const p = plan({ gestion: { risqueParTradePct: 0.1 } });
    const c = verifierLePlan(p, audit(), enDentsDeScie(60, 60), NAS, RIEN);
    expect(codes(c)).not.toContain("risque_par_trade_lourd");
  });

  it("ne dit rien sans risque par trade déclaré", () => {
    const c = verifierLePlan(plan(), audit(), enDentsDeScie(60, 60), NAS, RIEN);
    expect(codes(c)).not.toContain("risque_par_trade_lourd");
  });
});

describe("le niveau a-t-il le temps d'exister", () => {
  /**
   * ⚠️ Un pivot regarde des deux côtés : il n'est lisible que `pivots` bougies
   * APRÈS s'être formé. Sur une séance courte et une unité de temps large, il
   * n'a matériellement pas le temps d'apparaître avant la fermeture.
   */
  it("signale un niveau plus lent que la séance", () => {
    const p = plan({
      uniteDeTemps: 60,
      niveau: { type: "liquidite_swing", pivots: 10 },
      contexte: { fuseau: "Europe/Paris", debut: "14:30", fin: "17:00", jours: [1, 2, 3, 4, 5] },
    });
    expect(codes(verifierLePlan(p, audit(), trades(200, 60), NAS, RIEN))).toContain(
      "niveau_plus_lent_que_la_seance",
    );
  });

  it("ne dit rien quand le niveau tient dans la séance", () => {
    expect(codes(verifierLePlan(plan(), audit(), trades(200, 60), NAS, RIEN))).not.toContain(
      "niveau_plus_lent_que_la_seance",
    );
  });
});

describe("le taux de réussite qu'exige l'objectif", () => {
  /**
   * ⚠️ UNE DIVISION, PAS UN AVIS. Viser 2R demande un tiers de réussite pour
   * être à l'équilibre avant coûts.
   */
  it("signale un taux observé sous l'équilibre de l'objectif", () => {
    const c = verifierLePlan(plan(), audit(), trades(200, 60), NAS, RIEN, stats(0.25));
    const constat = c.find((x) => x.code === "reussite_sous_equilibre");
    expect(constat).toBeTruthy();
    expect(constat!.valeurs.equilibre).toBe("33.3");
  });

  it("ne dit rien quand le taux dépasse l'équilibre", () => {
    expect(codes(verifierLePlan(plan(), audit(), trades(200, 60), NAS, RIEN, stats(0.45)))).not.toContain(
      "reussite_sous_equilibre",
    );
  });

  /**
   * ⚠️ Sans statistiques, on n'invente pas un taux de réussite pour pouvoir
   * remplir une ligne : c'est exactement ce que le reste de la page refuse.
   */
  it("ne conclut rien sans statistiques", () => {
    expect(codes(verifierLePlan(plan(), audit(), trades(200, 60), NAS, RIEN))).not.toContain(
      "reussite_sous_equilibre",
    );
  });
});

describe("l'ordre et la rédaction", () => {
  it("met les constats bloquants avant les autres", () => {
    const c = verifierLePlan(plan(), audit({ refusesParGestion: 0 }), trades(900, 60, 5000), NAS, {
      pairs: ["XAUUSD"],
      max_trades_per_day: 3,
    });
    const premierAVerifier = c.findIndex((x) => x.gravite === "a_verifier");
    const dernierBloquant = c.map((x) => x.gravite).lastIndexOf("bloquant");
    if (premierAVerifier !== -1 && dernierBloquant !== -1) {
      expect(dernierBloquant).toBeLessThan(premierAVerifier);
    }
  });

  /**
   * ⚠️ DES CODES ET DES NOMBRES, JAMAIS DE PHRASES. La rédaction vit dans les
   * traductions, sinon ce module cesse d'être testable et cesse d'être traduit.
   */
  it("ne contient aucune phrase rédigée", () => {
    const source = readFileSync(join(process.cwd(), "lib/backtest/coherence-plan.ts"), "utf8");
    const sansCommentaires = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    // ⚠️ ON EXTRAIT LES LITTÉRAUX UN PAR UN. Une expression qui cherche « du
    // texte entre deux guillemets » attrape le CODE qui sépare deux chaînes sur
    // la même ligne, et accuse alors du code parfaitement juste : c'était le
    // premier jet de ce test, et il criait sur le `return` final du module.
    const litteraux = sansCommentaires.match(/"(?:[^"\\]|\\.)*"/g) ?? [];
    for (const l of litteraux) {
      const mots = l.slice(1, -1).trim().split(/\s+/).filter(Boolean);
      expect(mots.length, `phrase rédigée : ${l}`).toBeLessThan(4);
    }
  });

  it("chaque code sait se dire en français", () => {
    const tous: CodeConstat[] = [
      "instrument_hors_fiche",
      "rythme_hors_fiche",
      "rr_hors_fiche",
      "filtre_inerte",
      "filtre_presque_inerte",
      "risque_par_trade_lourd",
      "plafond_jour_inerte",
      "arret_inerte",
      "couts_lourds",
      "niveau_plus_lent_que_la_seance",
      "reussite_sous_equilibre",
      "collisions_nombreuses",
      "signaux_ecartes",
    ];
    const connues = fr as Record<string, string>;
    for (const code of tous) {
      expect(connues[`bt_coh_${code}`], `bt_coh_${code} manquante`).toBeTruthy();
    }
  });
});

/**
 * ⚠️⚠️ LE CONSTAT LE PLUS PARLANT QUE CETTE PAGE AIT PRODUIT, ET IL ÉTAIT
 * INVISIBLE.
 *
 * Vu à l'écran : le journal de recherche affichait trois lignes rigoureusement
 * identiques, « Objectif 1.5 R · 201 trades · t = 1.49 », puis « 2 R » et
 * « 3 R » avec exactement les mêmes chiffres. Doubler le rapport gain/risque
 * sans rien changer au résultat n'a qu'une explication : le prix n'atteint
 * jamais l'objectif. Le « RR de 1:2 » de sa fiche ne décrivait alors aucun de
 * ses trades, et l'outil le lui montrait sous forme de trois lignes redondantes
 * que personne n'aurait rapprochées.
 */
describe("l'objectif décide-t-il seulement d'une sortie", () => {
  const connues = fr as Record<string, string>;

  /** `n` trades sortis par ce motif, avec ce R. */
  const sorties = (n: number, motif: TradeSimule["motif"], r: number): TradeSimule[] =>
    trades(n, 10).map((t) => ({ ...t, motif, r, rBrut: r }));

  it("le dit quand aucune sortie ne vient de l'objectif", () => {
    const c = verifierLePlan(plan(), audit(), sorties(40, "fin_de_session", -0.2), NAS, {});
    const x = c.find((y) => y.code === "objectif_jamais_atteint")!;
    expect(x).toBeTruthy();
    expect(x.gravite).toBe("bloquant");
    expect(x.valeurs.trades).toBe(40);
  });

  /**
   * ⚠️ ON COMPTE LES SORTIES À L'OBJECTIF, PAS LES TRADES GAGNANTS. Un
   * trade fermé en fin de séance à +0,8 R est un gagnant et ne dit rien de la
   * cible : c'est justement cette confusion qui rend le constat invisible.
   */
  it("ne confond pas un trade gagnant avec un objectif atteint", () => {
    const c = verifierLePlan(plan(), audit(), sorties(40, "fin_de_session", 0.8), NAS, {});
    expect(c.map((x) => x.code)).toContain("objectif_jamais_atteint");
  });

  it("signale un objectif qui ne décide qu'une poignée de sorties", () => {
    const melange = [
      ...sorties(2, "objectif", 2),
      ...sorties(38, "stop", -1),
    ];
    const c = verifierLePlan(plan(), audit(), melange, NAS, {});
    const x = c.find((y) => y.code === "objectif_rare")!;
    expect(x).toBeTruthy();
    expect(x.valeurs.atteints).toBe(2);
  });

  it("ne reproche rien quand l'objectif décide souvent", () => {
    const melange = [...sorties(15, "objectif", 2), ...sorties(25, "stop", -1)];
    const codes = verifierLePlan(plan(), audit(), melange, NAS, {}).map((x) => x.code);
    expect(codes).not.toContain("objectif_jamais_atteint");
    expect(codes).not.toContain("objectif_rare");
  });

  /**
   * ⚠️ Sous trente trades, on ne dit rien : l'absence d'objectif atteint
   * sur dix trades n'apprend rien que le hasard n'expliquerait.
   */
  it("se tait sur un échantillon trop petit", () => {
    const c = verifierLePlan(plan(), audit(), sorties(10, "fin_de_session", -0.2), NAS, {});
    expect(c.map((x) => x.code)).not.toContain("objectif_jamais_atteint");
  });

  it("chaque code a sa rédaction", () => {
    for (const code of ["objectif_jamais_atteint", "objectif_rare"]) {
      expect(connues[`bt_coh_${code}`], `bt_coh_${code} manquante`).toBeTruthy();
    }
  });
});
