import { describe, expect, it } from "vitest";
import {
  composerBlocPlan,
  ecrireLePlanDansLaFiche,
  lireBlocPlan,
  sansLeBlocDePlan,
} from "./fiche-plan";
import { sansLeBlocDeBacktest } from "./fiche-reglages";

const bloc = (reponses: Record<string, string>, methode?: string) =>
  composerBlocPlan({
    titre: "Mon plan complet, 3 septembre 2026",
    methode,
    reponses,
    intitules: {
      invalidation: "Où ta thèse est fausse",
      ne_pas_trader: "Quand tu ne prends rien",
      regime: "Dans quel marché elle fonctionne",
    },
  });

describe("écrire le plan dans la fiche", () => {
  it("garde le texte du trader et met le bloc à la fin", () => {
    const fiche = "Je trade les trendlines sur NAS100.";
    const r = ecrireLePlanDansLaFiche(fiche, bloc({ invalidation: "sous le creux" }));
    expect(r.startsWith(fiche)).toBe(true);
    expect(r).toContain("[TRADEDISCIPLINE:PLAN]");
  });

  /**
   * ⚠️ ENREGISTRER DEUX FOIS NE DOIT LAISSER QU'UN BLOC. Sans ça, la fiche
   * enfle à chaque passage jusqu'à noyer ce que le trader avait rédigé.
   */
  it("remplace le bloc au lieu de l'empiler", () => {
    const un = ecrireLePlanDansLaFiche("Ma méthode.", bloc({ invalidation: "premier" }));
    const deux = ecrireLePlanDansLaFiche(un, bloc({ invalidation: "second" }));
    expect(deux.split("[TRADEDISCIPLINE:PLAN]")).toHaveLength(2);
    expect(deux).toContain("second");
    expect(deux).not.toContain("premier");
  });

  it("écrit un bloc seul quand la fiche est vide", () => {
    expect(ecrireLePlanDansLaFiche("", bloc({ regime: "tendance" })).startsWith("[TRADEDISCIPLINE:PLAN]")).toBe(true);
  });

  /**
   * ⚠️ UNE OUVERTURE SANS FERMETURE VEUT DIRE QUE QUELQU'UN A ÉDITÉ À LA MAIN.
   * On ne devine pas où le bloc s'arrête : on ajoute à la suite plutôt que
   * d'avaler la fin de sa fiche.
   */
  it("n'avale pas la fiche quand la borne de fin a été effacée", () => {
    const cassee = "Ma méthode.\n\n[TRADEDISCIPLINE:PLAN]\nreste de mon texte important";
    const r = ecrireLePlanDansLaFiche(cassee, bloc({ regime: "range" }));
    expect(r).toContain("reste de mon texte important");
  });
});

describe("relire le bloc", () => {
  it("retrouve chaque réponse par son code", () => {
    const f = ecrireLePlanDansLaFiche(
      "Ma méthode.",
      bloc({ invalidation: "sous le dernier creux H1", regime: "tendance seulement" }),
    );
    const r = lireBlocPlan(f);
    expect(r.reponses.invalidation).toBe("sous le dernier creux H1");
    expect(r.reponses.regime).toBe("tendance seulement");
  });

  it("retrouve la méthode déclarée", () => {
    const f = ecrireLePlanDansLaFiche("x", bloc({ regime: "range" }, "orderflow_absorption"));
    expect(lireBlocPlan(f).methode).toBe("orderflow_absorption");
  });

  it("ne rend rien quand il n'y a pas de bloc", () => {
    expect(lireBlocPlan("Juste ma méthode écrite à la main.")).toEqual({ reponses: {} });
  });

  it("n'écrit pas les réponses vides", () => {
    const f = ecrireLePlanDansLaFiche("x", bloc({ regime: "  ", invalidation: "ok" }));
    expect(lireBlocPlan(f).reponses.regime).toBeUndefined();
    expect(lireBlocPlan(f).reponses.invalidation).toBe("ok");
  });

  /**
   * ⚠️ UNE RÉPONSE SUR DEUX LIGNES FERAIT PASSER LA SECONDE POUR UNE NOUVELLE
   * CLÉ, et la relecture rendrait des paires absurdes. On aplatit, on ne refuse
   * pas : refuser une réponse parce qu'elle est bien rédigée serait absurde.
   */
  it("survit à une réponse écrite sur plusieurs lignes", () => {
    const f = ecrireLePlanDansLaFiche("x", bloc({ ne_pas_trader: "pas de news\npas le vendredi" }));
    const r = lireBlocPlan(f);
    expect(r.reponses.ne_pas_trader).toBe("pas de news pas le vendredi");
    expect(Object.keys(r.reponses)).toHaveLength(1);
  });

  /**
   * ⚠️ ON RELIT LE CODE, PAS L'INTITULÉ : l'intitulé est traduit et changera.
   * Un trader qui passe son interface en anglais doit retrouver ses réponses.
   */
  it("retrouve la réponse même si l'intitulé a été traduit entre-temps", () => {
    const enAnglais = composerBlocPlan({
      titre: "My full plan",
      reponses: { invalidation: "below the last low" },
      intitules: { invalidation: "Where your idea is wrong" },
    });
    expect(lireBlocPlan(enAnglais).reponses.invalidation).toBe("below the last low");
  });

  it("survit à une réponse qui contient elle-même des deux-points", () => {
    const f = ecrireLePlanDansLaFiche("x", bloc({ regime: "tendance : jamais en range" }));
    expect(lireBlocPlan(f).reponses.regime).toBe("tendance : jamais en range");
  });
});

/**
 * ⚠️⚠️ LA LEÇON LA PLUS CHÈRE DU CHANTIER. L'outil écrivait sa sortie dans la
 * fiche, puis la relisait comme si le trader l'avait écrite : le compilateur
 * listait « Largeur du pivot : 10 → 5 » parmi les cinq règles de sa stratégie.
 */
describe("ce que le compilateur ne doit plus jamais relire", () => {
  it("retire le bloc de plan", () => {
    const f = ecrireLePlanDansLaFiche("Ma méthode à moi.", bloc({ regime: "tendance" }));
    expect(sansLeBlocDePlan(f)).toBe("Ma méthode à moi.");
  });

  it("laisse la fiche intacte quand il n'y a pas de bloc", () => {
    expect(sansLeBlocDePlan("Ma méthode.")).toBe("Ma méthode.");
  });

  it("coupe à l'ouverture quand la fermeture a été effacée", () => {
    expect(sansLeBlocDePlan("Ma méthode.\n[TRADEDISCIPLINE:PLAN]\nabc")).toBe("Ma méthode.");
  });

  it("les deux retraits se composent sans se gêner", () => {
    const avecPlan = ecrireLePlanDansLaFiche("Ma méthode.", bloc({ regime: "tendance" }));
    const avecTout = `${avecPlan}\n\n[TRADEDISCIPLINE:BACKTEST]\nLargeur du pivot 10 → 5\n[/TRADEDISCIPLINE:BACKTEST]`;
    expect(sansLeBlocDePlan(sansLeBlocDeBacktest(avecTout)).trim()).toBe("Ma méthode.");
  });
});
