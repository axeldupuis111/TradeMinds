import { describe, expect, it } from "vitest";
import {
  CODES_QUESTIONS,
  evaluerCompletude,
  QUESTIONS_DECLARATIVES,
  type ContexteCompletude,
} from "./completude";
import { methodeParCode } from "./methodes";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import type { PlanExecution } from "./types";
import fr from "../i18n/fr";

const NAS = instrumentParCode("NAS100")!;
const connues = fr as Record<string, string>;

const plan = (p: Partial<PlanExecution> = {}): PlanExecution => ({
  ...socleDePlan(NAS.code, "UTC"),
  uniteDeTemps: 15,
  contexte: { fuseau: "UTC", debut: "08:00", fin: "17:00", jours: [1, 2, 3, 4, 5] },
  niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3000 },
  declencheur: { type: "cassure", mode: "cloture" },
  confirmations: [],
  stop: { type: "dernier_pivot", bufferTicks: 200 },
  objectif: { type: "multiple_r", r: 2 },
  gestion: {},
  couts: coutsPourInstrument(NAS),
  ...p,
});

const etatDe = (c: ContexteCompletude, code: string) =>
  evaluerCompletude(c).lignes.find((l) => l.code === code)!;

describe("les treize questions", () => {
  it("sont bien treize, et sans doublon", () => {
    expect(CODES_QUESTIONS).toHaveLength(13);
    expect(new Set(CODES_QUESTIONS).size).toBe(13);
  });

  it.each(CODES_QUESTIONS)("« %s » a son intitulé et son aide", (code) => {
    expect(connues[`bt_q_${code}`], `bt_q_${code} manquante`).toBeTruthy();
    expect(connues[`bt_q_${code}_aide`], `bt_q_${code}_aide manquante`).toBeTruthy();
  });

  it("chaque état et chaque source ont leur rédaction", () => {
    for (const e of ["ecrit", "flou", "absent"]) {
      expect(connues[`bt_q_etat_${e}`], `bt_q_etat_${e} manquante`).toBeTruthy();
    }
    for (const s of ["plan", "fiche", "toi", "aucune"]) {
      expect(connues[`bt_q_source_${s}`], `bt_q_source_${s} manquante`).toBeTruthy();
    }
  });

  it("les questions déclaratives existent toutes", () => {
    for (const q of QUESTIONS_DECLARATIVES) expect(CODES_QUESTIONS).toContain(q);
  });
});

/**
 * ⚠️⚠️ LE CAS QUI JUSTIFIE TOUT LE FICHIER. Un trader d'orderflow ne verra jamais
 * un backtest de sa méthode : sans plan compilé, le diagnostic doit quand même
 * rendre treize lignes exploitables, sinon on n'a rien à lui dire.
 */
describe("sans aucun plan compilé", () => {
  const nu: ContexteCompletude = { reponses: {} };

  it("rend quand même les treize lignes", () => {
    expect(evaluerCompletude(nu).lignes).toHaveLength(13);
  });

  it("les déclare absentes plutôt que de deviner", () => {
    const r = evaluerCompletude(nu);
    expect(r.absents).toBe(13);
    expect(r.ecrits).toBe(0);
  });

  it("les réponses du trader comptent autant que celles du plan", () => {
    const l = etatDe({ reponses: { invalidation: "sous le dernier creux H1" } }, "invalidation");
    expect(l.etat).toBe("ecrit");
    expect(l.source).toBe("toi");
  });
});

describe("avec un plan compilé", () => {
  it("le setup et le déclencheur sont écrits par construction", () => {
    const c: ContexteCompletude = { plan: plan(), reponses: {} };
    expect(etatDe(c, "setup").etat).toBe("ecrit");
    expect(etatDe(c, "declencheur").etat).toBe("ecrit");
  });

  /**
   * ⚠️ LA DISTINCTION QUI SAUVE DES COMPTES : un stop structurel porte une
   * invalidation implicite, il ne la REMPLACE pas. « Flou », donc, et pas
   * « écrit » : le trader doit encore dire à quel moment sa thèse est fausse.
   */
  it("un stop structurel rend l'invalidation floue, jamais écrite", () => {
    const c: ContexteCompletude = {
      plan: plan({ stop: { type: "dernier_pivot", bufferTicks: 10 } }),
      reponses: {},
    };
    expect(etatDe(c, "invalidation").etat).toBe("flou");
  });

  it("un stop à distance fixe ne dit rien de l'invalidation", () => {
    const c: ContexteCompletude = { plan: plan({ stop: { type: "fixe", ticks: 200 } }), reponses: {} };
    expect(etatDe(c, "invalidation").etat).toBe("absent");
  });

  it("une plage horaire ouverte ne compte pas comme une séance", () => {
    const p = plan();
    const c: ContexteCompletude = {
      plan: { ...p, contexte: { ...p.contexte, debut: "00:00", fin: "23:59" } },
      reponses: {},
    };
    expect(etatDe(c, "seance").etat).toBe("absent");
  });

  it("une plage horaire restreinte compte comme une séance", () => {
    const p = plan();
    const c: ContexteCompletude = {
      plan: { ...p, contexte: { ...p.contexte, debut: "09:30", fin: "11:30" } },
      reponses: {},
    };
    expect(etatDe(c, "seance").etat).toBe("ecrit");
  });

  /**
   * ⚠️ LES GARDE-FOUS DISENT QUAND ARRÊTER, PAS QUAND S'ABSTENIR. Ils se
   * déclenchent après les pertes ; « quand est-ce que je ne prends pas de
   * position » se décide avant l'entrée. Confondre les deux laisserait la ligne
   * la plus manquante de toutes se croire remplie.
   */
  it("des garde-fous chiffrés ne répondent pas à « quand ne pas trader »", () => {
    const c: ContexteCompletude = {
      plan: plan({ gestion: { maxTradesParJour: 3, maxPertesConsecutives: 2 } }),
      reponses: {},
    };
    expect(etatDe(c, "garde_fous").etat).toBe("ecrit");
    expect(etatDe(c, "ne_pas_trader").etat).toBe("flou");
  });

  it("un seul garde-fou ne suffit pas à les déclarer écrits", () => {
    const c: ContexteCompletude = {
      plan: plan({ gestion: { maxPertesConsecutives: 3 } }),
      reponses: {},
    };
    expect(etatDe(c, "garde_fous").etat).toBe("flou");
  });

  it("un sens unique répond au contexte directionnel", () => {
    expect(etatDe({ plan: plan({ sens: "long" }), reponses: {} }, "contexte_directionnel").etat).toBe(
      "ecrit",
    );
  });

  it("le régime ne se déduit jamais complètement d'un filtre", () => {
    const c: ContexteCompletude = {
      plan: plan({ confirmations: [{ type: "biais_moyenne", periode: 50 }] }),
      reponses: {},
    };
    expect(etatDe(c, "regime").etat).toBe("flou");
  });
});

describe("les colonnes de la fiche", () => {
  it("un risque par trade renseigné dans la fiche compte", () => {
    const l = etatDe({ fiche: { risqueParTradePct: 1 }, reponses: {} }, "risque");
    expect(l.etat).toBe("ecrit");
    expect(l.source).toBe("fiche");
  });

  it("un risque à zéro ne compte pas", () => {
    expect(etatDe({ fiche: { risqueParTradePct: 0 }, reponses: {} }, "risque").etat).toBe("absent");
  });

  it("un RR seul ne suffit pas à décrire une sortie", () => {
    expect(etatDe({ fiche: { riskReward: 2 }, reponses: {} }, "sortie").etat).toBe("flou");
  });
});

describe("la référence de la méthode", () => {
  /**
   * ⚠️ ON NE REND QUE CE QUE LE RÉFÉRENTIEL DÉCLARE. Fabriquer une réponse de
   * référence en prose serait un conseil d'investissement déguisé en aide au
   * remplissage.
   */
  it("rappelle les régimes déclarés par la méthode", () => {
    const l = etatDe(
      { reponses: {}, methode: methodeParCode("vwap_reversion") },
      "regime",
    );
    expect(l.reference?.cle).toBe("bt_ref_regimes");
    expect(String(l.reference?.valeurs.liste)).toContain("range");
  });

  it("rappelle la séance quand la méthode en déclare une", () => {
    const l = etatDe({ reponses: {}, methode: methodeParCode("ict_silver_bullet") }, "seance");
    expect(l.reference?.cle).toBe("bt_ref_seance");
  });

  it("ne rappelle rien quand la méthode ne déclare rien", () => {
    expect(etatDe({ reponses: {}, methode: methodeParCode("trendline") }, "seance").reference)
      .toBeUndefined();
  });

  it("sans méthode déclarée, aucune référence n'est inventée", () => {
    for (const l of evaluerCompletude({ reponses: {} }).lignes) {
      expect(l.reference, l.code).toBeUndefined();
    }
  });

  it("chaque clé de référence existe en français", () => {
    const cles = new Set<string>();
    for (const code of ["trendline", "ict_silver_bullet", "orderflow_absorption"]) {
      for (const l of evaluerCompletude({ reponses: {}, methode: methodeParCode(code) }).lignes) {
        if (l.reference) cles.add(l.reference.cle);
      }
    }
    expect(cles.size).toBeGreaterThan(0);
    for (const c of Array.from(cles)) expect(connues[c], `${c} manquante`).toBeTruthy();
  });
});

/**
 * ⚠️⚠️ AUCUNE NOTE, ET UN TEST POUR L'INTERDIRE. Un score de complétude se
 * compare entre traders, se capture en photo, et transforme « il me manque
 * l'invalidation » en « je suis à 78 % ».
 */
describe("aucune note", () => {
  it("ne rend que des comptes, jamais une moyenne", () => {
    const r = evaluerCompletude({ plan: plan(), reponses: {} });
    expect(Object.keys(r).sort()).toEqual(["absents", "ecrits", "flous", "lignes"]);
    expect(r.ecrits + r.flous + r.absents).toBe(13);
  });
});
