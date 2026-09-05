import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { composerPlanComplet, SEUIL_RECUL_PAR_DEFAUT } from "./plan-complet";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import fr from "../i18n/fr";
import type { PlanExecution, TradeSimule } from "./types";

const NAS = instrumentParCode("NAS100")!;

function plan(partiel: Partial<PlanExecution> = {}): PlanExecution {
  return {
    ...socleDePlan("NAS100", "Europe/Paris"),
    uniteDeTemps: 15,
    contexte: { fuseau: "Europe/Paris", debut: "08:00", fin: "22:00", jours: [1, 2, 3, 4, 5] },
    niveau: { type: "trendline", pivots: 10, touchesMin: 3, toleranceTicks: 3000 },
    declencheur: { type: "cassure", mode: "cloture" },
    confirmations: [],
    stop: { type: "dernier_pivot", bufferTicks: 200 },
    objectif: { type: "multiple_r", r: 2 },
    gestion: {},
    couts: coutsPourInstrument(NAS),
    ...partiel,
  };
}

/** Une suite de R, un trade par jour, dans l'ordre donné. */
function trades(rs: number[]): TradeSimule[] {
  return rs.map((r, i) => {
    const ms = Date.UTC(2024, 0, 1) + i * 86_400_000;
    return {
      signalMs: ms,
      niveauSignal: 0,
      entreeMs: ms,
      sortieMs: ms + 3_600_000,
      sens: "long" as const,
      entreeTicks: 0,
      sortieTicks: 0,
      risqueTicks: 1000,
      r,
      rBrut: r,
      mfeR: Math.max(0, r),
      maeR: Math.min(0, r),
      motif: "objectif" as const,
      collisionMemeBarre: false,
    };
  });
}

/** Une suite qui gagne doucement, avec une série de pertes au milieu. */
function suite(): number[] {
  const rs: number[] = [];
  for (let i = 0; i < 40; i++) rs.push(i % 3 === 0 ? 2 : -1);
  rs.push(-1, -1, -1, -1, -1);
  for (let i = 0; i < 40; i++) rs.push(i % 3 === 0 ? 2 : -1);
  return rs;
}

const ligne = (p: ReturnType<typeof composerPlanComplet>, cle: string) =>
  p.lignes.find((l) => l.cle === cle);

describe("le plan complet", () => {
  it("recopie ce qu'il faut savoir avant d'ouvrir le graphique", () => {
    const p = composerPlanComplet(plan(), trades(suite()), NAS);
    for (const cle of ["actif", "unite_de_temps", "jours", "heures", "sens", "niveau", "declencheur", "stop", "objectif"]) {
      expect(ligne(p, cle), cle).toBeTruthy();
    }
    expect(ligne(p, "actif")!.valeurs.instrument).toBe("Nasdaq 100");
    expect(ligne(p, "unite_de_temps")!.valeurs.minutes).toBe(15);
    expect(ligne(p, "jours")!.valeurs.jours).toBe("L M M J V");
  });

  /**
   * ⚠️ LA MOITIÉ DES LIGNES DOIT ÊTRE DÉDUITE DE LA MESURE. Un plan qui se
   * contenterait de redire les réglages n'apprendrait rien : ce qui manque au
   * trader, ce n'est pas la liste de ses réglages, c'est ce qu'ils lui ont fait.
   */
  it("distingue ce qui est recopié de ce qui est mesuré", () => {
    const p = composerPlanComplet(plan(), trades(suite()), NAS);
    expect(p.lignes.some((l) => l.deduite)).toBe(true);
    expect(ligne(p, "actif")!.deduite).toBe(false);
    expect(ligne(p, "serie_de_pertes")!.deduite).toBe(true);
  });

  it("compte la plus longue série de pertes réellement traversée", () => {
    const p = composerPlanComplet(plan(), trades([2, -1, -1, -1, -1, -1, -1, 2, -1, -1]), NAS);
    expect(ligne(p, "serie_de_pertes")!.valeurs.n).toBe(6);
  });

  /**
   * ⚠️ UNE RÈGLE D'ARRÊT QU'ON N'A JAMAIS VUE S'APPLIQUER N'EST PAS UNE RÈGLE,
   * c'est une intention. Le nombre de déclenchements est la seule chose qui la
   * rende réelle pour celui qui doit la respecter.
   */
  it("dit combien de fois la règle d'arrêt se serait déclenchée", () => {
    const p = composerPlanComplet(
      plan({ gestion: { maxPertesConsecutives: 3 } }),
      trades([-1, -1, -1, 2, -1, -1, -1, -1, -1, -1]),
      NAS,
    );
    // Une série de trois, puis une de six : trois déclenchements en tout.
    expect(ligne(p, "arret_pertes")!.valeurs.fois).toBe(3);
  });

  it("signale l'absence de règle d'arrêt plutôt que de l'inventer", () => {
    const p = composerPlanComplet(plan(), trades(suite()), NAS);
    expect(ligne(p, "arret_pertes")).toBeUndefined();
    expect(ligne(p, "arret_pertes_absent")).toBeTruthy();
  });

  /**
   * ⚠️⚠️ VU À L'ÉCRAN : « Attends-toi à 2 trades par jour, 2 les jours les
   * plus chargés. » La phrase promet un contraste et rend deux fois le même
   * nombre, ce qui la fait lire comme une panne. Ce n'était pas un arrondi : le
   * neuvième décile et le maximum valaient vraiment 2 tous les deux.
   *
   * ⚠️ ET C'EST UNE INFORMATION PLUS FORTE, PAS PLUS FAIBLE : quand les deux se
   * rejoignent, le rythme n'a jamais dépassé ce chiffre de toute la période.
   *
   * Le test d'origine construisait par accident exactement ce cas-là (trois
   * trades tous les jours, sans exception) et affirmait la phrase à contraste.
   */
  it("dit le plafond quand le rythme ne l'a jamais dépassé", () => {
    const regulier = trades(suite()).map((t, i) => ({
      ...t,
      // Trois trades le même jour, tous les jours : le décile égale le maximum.
      entreeMs: Date.UTC(2024, 0, 1) + Math.floor(i / 3) * 86_400_000,
    }));
    const p = composerPlanComplet(plan(), regulier, NAS);
    expect(ligne(p, "rythme")).toBeUndefined();
    const l = ligne(p, "rythme_plafond")!;
    expect(l).toBeTruthy();
    expect(l.valeurs.max).toBe(3);
    expect(l.valeurs.d9).toBe(3);
  });

  it("garde la phrase à contraste quand une journée dépasse les autres", () => {
    // Un trade par jour, sauf une journée qui en porte cinq.
    const irregulier = trades(suite()).map((t, i) => ({
      ...t,
      entreeMs: Date.UTC(2024, 0, 1) + (i < 5 ? 0 : (i - 4) * 86_400_000),
    }));
    const p = composerPlanComplet(plan(), irregulier, NAS);
    const l = ligne(p, "rythme") ?? ligne(p, "rythme_un")!;
    expect(l).toBeTruthy();
    expect(l.valeurs.max).toBe(5);
    expect(l.valeurs.d9).not.toBe(l.valeurs.max);
  });

  /**
   * ⚠️ LES QUATRE FORMES ONT LEUR RÉDACTION, et deux d'entre elles ne sont
   * citées que dans une branche : le balayage des clés littérales ne prouve
   * rien sur leur existence.
   */
  it("a une phrase pour chacune des quatre formes du rythme", () => {
    const c = fr as Record<string, string>;
    for (const k of ["bt_plan_rythme", "bt_plan_rythme_un", "bt_plan_rythme_plafond", "bt_plan_rythme_un_plafond"]) {
      expect(c[k], `${k} manquante`).toBeTruthy();
    }
    // ⚠️ Les deux formes « plafond » ne doivent PAS reparler d'un maximum
    // distinct : c'est exactement la répétition qu'elles remplacent.
    expect(c.bt_plan_rythme_un_plafond).not.toContain("{d9}");
  });
});

describe("le risque par trade, déduit du recul qu'il produit", () => {
  /**
   * ⚠️ LE PLUS HAUT QUI TIENT, PAS LE PLUS RENTABLE. On ne maximise rien : on
   * cherche la limite au-delà de laquelle le trader ne tiendrait pas, et on
   * s'arrête juste en dessous. Un risque « optimal » calculé sur le passé est la
   * façon la plus rapide de faire sauter un compte sur l'avenir.
   */
  it("retient le plus haut risque qui garde le recul sous le seuil", () => {
    const p = composerPlanComplet(plan(), trades(suite()), NAS);
    expect(p.risqueRecommandePct).not.toBeNull();
    const choisi = p.risques.find((r) => r.risquePct === p.risqueRecommandePct)!;
    expect(choisi.reculPct).toBeLessThanOrEqual(p.seuilReculPct);
    const plusHauts = p.risques.filter((r) => r.risquePct > p.risqueRecommandePct!);
    for (const r of plusHauts) {
      expect(r.ruine || r.reculPct > p.seuilReculPct).toBe(true);
    }
  });

  it("rend le tableau complet pour que le trader tranche lui-même", () => {
    const p = composerPlanComplet(plan(), trades(suite()), NAS);
    expect(p.risques.length).toBeGreaterThan(4);
    for (const r of p.risques) expect(Number.isFinite(r.reculPct)).toBe(true);
  });

  it("le recul grandit avec le risque", () => {
    const p = composerPlanComplet(plan(), trades(suite()), NAS);
    const sansRuine = p.risques.filter((r) => !r.ruine);
    for (let i = 1; i < sansRuine.length; i++) {
      expect(sansRuine[i].reculPct).toBeGreaterThanOrEqual(sansRuine[i - 1].reculPct);
    }
  });

  /**
   * ⚠️ Quand même le risque le plus petit fait sauter le seuil, on ne recommande
   * RIEN. Proposer quand même le moins mauvais reviendrait à dire « c'est
   * tenable » d'une méthode qui ne l'est pas.
   */
  it("ne recommande rien quand aucun risque ne tient", () => {
    const catastrophe = trades(Array.from({ length: 200 }, () => -1));
    const p = composerPlanComplet(plan(), catastrophe, NAS);
    expect(p.risqueRecommandePct).toBeNull();
    expect(ligne(p, "risque_aucun")).toBeTruthy();
  });

  it("respecte un seuil de recul différent", () => {
    const large = composerPlanComplet(plan(), trades(suite()), NAS, 60);
    const serre = composerPlanComplet(plan(), trades(suite()), NAS, 5);
    expect(large.seuilReculPct).toBe(60);
    if (large.risqueRecommandePct != null && serre.risqueRecommandePct != null) {
      expect(large.risqueRecommandePct).toBeGreaterThanOrEqual(serre.risqueRecommandePct);
    }
  });

  it("part du seuil déclaré quand on ne lui en donne pas", () => {
    expect(composerPlanComplet(plan(), trades(suite()), NAS).seuilReculPct).toBe(
      SEUIL_RECUL_PAR_DEFAUT,
    );
  });
});

describe("chaque ligne du plan sait se dire en français", () => {
  const connues = fr as Record<string, string>;
  const toutesLesCles = [
    ...composerPlanComplet(plan({ gestion: { maxPertesConsecutives: 3 } }), trades(suite()), NAS)
      .lignes.map((l) => l.cle),
    "arret_pertes_absent",
    "risque_aucun",
    // Quand le risque retenu est le dernier de la liste, la phrase change.
    "risque_plafond",
    // Le rythme a deux redactions : « 1 trades par jour » etait ecrit tel quel
    // dans un plan qu'on imprime pour le suivre.
    "rythme_un",
  ];

  it.each(Array.from(new Set(toutesLesCles)))("« %s »", (cle) => {
    expect(connues[`bt_plan_${cle}`], `bt_plan_${cle} manquante`).toBeTruthy();
  });
});

/**
 * CE QUE LE PLAN TROUVE A DEMONTRE, DIT AVANT LE PLAN.
 *
 * ⚠️⚠️ VU A L'ECRAN SUR LA VRAIE STRATEGIE : la confirmation disait
 * « trop peu de trades pour trancher » et l'outil titrait juste en dessous
 * « Ton plan, ecrit · Les regles a respecter ». Chaque etat doit avoir sa
 * phrase, sinon un plan que rien n'a confirme se lit comme un plan a suivre.
 */
describe("chaque etat du plan trouve a sa phrase", () => {
  const SOURCE = readFileSync(join(process.cwd(), "components/backtest/Trouver.tsx"), "utf8");
  const i = SOURCE.indexOf("export type EtatDuPlan =");

  it("l'union EtatDuPlan est lue dans la source, pas recopiee", () => {
    expect(i).toBeGreaterThan(-1);
  });

  it("chaque etat a sa cle en francais", () => {
    const union = SOURCE.slice(i, SOURCE.indexOf(";", i));
    const etats = Array.from(union.matchAll(/"([a-z_]+)"/g), (m) => m[1]);
    expect(etats.length).toBeGreaterThan(1);
    const connues = fr as Record<string, string>;
    for (const e of etats) {
      expect(connues[`bt_plan_etat_${e}`], `bt_plan_etat_${e} manquante`).toBeTruthy();
    }
  });
});

/**
 * ⚠️⚠️ « LE PLUS HAUT RISQUE QUI TIENT » N'EST PAS LA MÊME PHRASE QUAND ON A
 * BUTÉ SUR LE HAUT DE LA LISTE.
 *
 * Vu à l'écran : « tu risques 5 % du capital par trade, c'est le plus haut
 * risque qui garde ton recul sous 20 %. Au-dessus, tu ne tiendrais pas la
 * série. » Or 5 % est simplement le dernier de la liste des risques essayés :
 * on n'a jamais regardé 6 %, et rien ne dit qu'il casserait. La phrase
 * affirmait une limite trouvée là où il n'y avait qu'un bout de tableau.
 */
describe("le risque retenu ne s'annonce pas comme une limite trouvée", () => {
  /** Une suite de R si sage que même le risque le plus haut tient. */
  const douce = () => trades(Array.from({ length: 60 }, (_, i) => (i % 5 === 0 ? -0.2 : 0.1)));

  it("change de phrase quand le risque retenu est le plafond de la liste", () => {
    const p = composerPlanComplet(plan(), douce(), NAS);
    const risque = p.risques[p.risques.length - 1];
    expect(p.risqueRecommandePct).toBe(risque.risquePct);
    expect(p.lignes.map((l) => l.cle)).toContain("risque_plafond");
    expect(p.lignes.map((l) => l.cle)).not.toContain("risque");
  });

  it("garde la phrase ordinaire quand la limite a vraiment été trouvée", () => {
  const rude = trades(Array.from({ length: 60 }, (_, i) => (i < 12 ? -1 : 0.2)));
    const p = composerPlanComplet(plan(), rude, NAS);
    if (p.risqueRecommandePct != null) {
      const plafond = p.risques[p.risques.length - 1].risquePct;
      expect(p.risqueRecommandePct).toBeLessThan(plafond);
      expect(p.lignes.map((l) => l.cle)).toContain("risque");
    }
  });
});
