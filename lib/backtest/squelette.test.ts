import { describe, expect, it } from "vitest";
import { composerSquelette } from "./squelette";
import { declencheurStandard, niveauStandard } from "./blocs-standards";
import { METHODES, methodeParCode } from "./methodes";
import { socleDePlan } from "./compilation";
import { coutsPourInstrument, instrumentParCode } from "./instruments";
import type { PlanExecution } from "./types";
import fr from "../i18n/fr";

const NAS = instrumentParCode("NAS100")!;
const EUR = instrumentParCode("EURUSD")!;
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

describe("les blocs standards", () => {
  /**
   * ⚠️ LES DISTANCES SE DÉRIVENT DU SPREAD, jamais d'un nombre écrit en dur :
   * « six points » vaut un tiers de bougie sur le Nasdaq et six bougies sur
   * l'EUR/USD.
   */
  it("met l'échelle de l'instrument dans les distances", () => {
    const surNas = niveauStandard("order_block", NAS);
    const surEur = niveauStandard("order_block", EUR);
    expect(surNas).toBeTruthy();
    expect(surEur).toBeTruthy();
    if (surNas?.type === "order_block" && surEur?.type === "order_block") {
      expect(surNas.impulsionMinTicks).not.toBe(surEur.impulsionMinTicks);
    }
  });

  it("ne devine jamais la plage d'un range horaire", () => {
    expect(niveauStandard("range_horaire", NAS)).toBeNull();
    expect(niveauStandard("range_horaire", NAS, { debut: "09:30", fin: "10:30" })).toEqual({
      type: "range_horaire",
      debut: "09:30",
      fin: "10:30",
    });
  });

  it("rend un déclencheur pour chaque type du catalogue", () => {
    for (const t of [
      "cassure",
      "balayage_retour",
      "retest_apres_cassure",
      "fvg_puis_retest",
      "balayage_puis_fvg",
      "entree_dans_zone",
    ] as const) {
      expect(declencheurStandard(t, NAS).type, t).toBe(t);
    }
  });

  it("sait fabriquer tous les niveaux cités par le référentiel", () => {
    for (const m of METHODES) {
      if (!m.squelette?.niveau) continue;
      const n = niveauStandard(m.squelette.niveau, NAS, { debut: "09:00", fin: "10:00" });
      expect(n, `${m.code} / ${m.squelette.niveau}`).toBeTruthy();
    }
  });
});

describe("le squelette d'une méthode", () => {
  /**
   * ⚠️⚠️ `null` EST UNE RÉPONSE, et c'est celle du carnet d'ordres. Fabriquer un
   * squelette pour une méthode dont on ne sait même pas approcher le niveau
   * rendrait un chiffre qui ne décrit rien.
   */
  it("refuse de fabriquer un squelette au carnet d'ordres", () => {
    expect(composerSquelette(methodeParCode("orderflow_carnet")!, plan(), NAS)).toBeNull();
  });

  it("refuse aussi pour le scalping d'annonces", () => {
    expect(composerSquelette(methodeParCode("news_scalping")!, plan(), NAS)).toBeNull();
  });

  it("fabrique le décor de l'orderflow, et dit ce qu'il ne reproduit pas", () => {
    const s = composerSquelette(methodeParCode("orderflow_absorption")!, plan(), NAS)!;
    expect(s.plan.niveau.type).toBe("extremes_veille");
    expect(s.nonReproduit).toContain("absorption");
    expect(s.nonReproduit).toContain("delta_agressif");
  });

  /**
   * ⚠️ ON GARDE TOUT CE QUI EST À LUI. Sa séance, son unité de temps, son stop,
   * son objectif, son risque et ses coûts : on ne remplace que ce que le
   * référentiel dit remplacer.
   */
  it("ne touche ni à sa séance, ni à son risque, ni à ses coûts", () => {
    const base = plan({ gestion: { risqueParTradePct: 1.25, maxTradesParJour: 2 } });
    const s = composerSquelette(methodeParCode("volume_profile")!, base, NAS)!;
    expect(s.plan.contexte).toEqual(base.contexte);
    expect(s.plan.gestion).toEqual(base.gestion);
    expect(s.plan.couts).toEqual(base.couts);
    expect(s.plan.stop).toEqual(base.stop);
    expect(s.plan.objectif).toEqual(base.objectif);
  });

  it("déclare chaque bloc qu'il a remplacé", () => {
    const s = composerSquelette(methodeParCode("volume_profile")!, plan(), NAS)!;
    expect(s.approxime.map((a) => a.bloc)).toContain("niveau");
    for (const a of s.approxime) {
      expect(["niveau", "declencheur"]).toContain(a.bloc);
    }
  });

  it("ne déclare pas remplacé ce qui était déjà le sien", () => {
    const base = plan({ niveau: { type: "extremes_veille" } });
    const s = composerSquelette(methodeParCode("orderflow_absorption")!, base, NAS)!;
    expect(s.approxime.map((a) => a.bloc)).not.toContain("niveau");
  });

  it("cale la plage de référence sur sa propre séance", () => {
    const base = plan();
    const avecSeance = {
      ...base,
      contexte: { ...base.contexte, debut: "09:30", fin: "16:00" },
    };
    const s = composerSquelette(methodeParCode("wyckoff")!, avecSeance, NAS)!;
    expect(s.plan.niveau).toEqual({ type: "range_horaire", debut: "09:30", fin: "10:30" });
  });

  it("ne déborde pas de la journée quand la séance commence tard", () => {
    const base = plan();
    const tard = { ...base, contexte: { ...base.contexte, debut: "23:30", fin: "23:59" } };
    const s = composerSquelette(methodeParCode("wyckoff")!, tard, NAS)!;
    if (s.plan.niveau.type === "range_horaire") {
      expect(s.plan.niveau.fin).toBe("23:59");
    }
  });

  it("chaque bloc de remplacement a un nom lisible", () => {
    for (const m of METHODES) {
      const s = composerSquelette(m, plan(), NAS);
      if (!s) continue;
      for (const a of s.approxime) {
        expect(connues[`bt_sq_bloc_${a.bloc}`], `bt_sq_bloc_${a.bloc} manquante`).toBeTruthy();
      }
    }
  });
});
