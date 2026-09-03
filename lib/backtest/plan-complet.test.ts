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

  it("dit le rythme à attendre, au neuvième décile et au maximum", () => {
    const beaucoup = trades(suite()).map((t, i) => ({
      ...t,
      // Trois trades le même jour, tous les trois trades.
      entreeMs: Date.UTC(2024, 0, 1) + Math.floor(i / 3) * 86_400_000,
    }));
    const p = composerPlanComplet(plan(), beaucoup, NAS);
    expect(ligne(p, "rythme")!.valeurs.max).toBe(3);
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
