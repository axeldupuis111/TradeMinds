import { describe, expect, it } from "vitest";
import { COACH_TOOLS, TOOL_MIN_PLAN, coachToolsForPlan, planAllowsTool } from "./coach-tools";

const names = (plan: Parameters<typeof coachToolsForPlan>[0]) =>
  coachToolsForPlan(plan).map((t) => t.name);

describe("tiérage des outils du coach", () => {
  it("classe TOUS les outils du catalogue", () => {
    // Un outil non classé retombe silencieusement en `free`. Pour un outil
    // d'écriture ce serait une faille de gating, pas un simple oubli.
    const nonClasses = COACH_TOOLS.map((t) => t.name).filter((n) => !(n in TOOL_MIN_PLAN));
    expect(nonClasses, `outils sans plan minimum : ${nonClasses.join(", ")}`).toEqual([]);
  });

  it("ne référence aucun outil inexistant", () => {
    const existants = new Set(COACH_TOOLS.map((t) => t.name));
    const fantomes = Object.keys(TOOL_MIN_PLAN).filter((n) => !existants.has(n));
    expect(fantomes, `outils classés mais absents : ${fantomes.join(", ")}`).toEqual([]);
  });

  it("laisse le gratuit lire, jamais écrire", () => {
    const free = names("free");
    expect(free).toContain("find_trades");
    expect(free).toContain("list_strategies");
    for (const ecriture of ["annotate_trades", "create_goal", "delete_goal", "update_strategy", "export_trades"]) {
      expect(free, `${ecriture} ne doit pas être accessible au gratuit`).not.toContain(ecriture);
    }
  });

  it("donne au Plus les actions de coaching", () => {
    const plus = names("plus");
    for (const t of ["annotate_trades", "create_goal", "update_strategy", "save_coach_note"]) {
      expect(plus).toContain(t);
    }
  });

  it("donne au Premium au moins autant qu'au Plus, et au Plus au moins autant qu'au gratuit", () => {
    const free = names("free"), plus = names("plus"), premium = names("premium");
    expect(free.every((t) => plus.includes(t))).toBe(true);
    expect(plus.every((t) => premium.includes(t))).toBe(true);
    expect(premium.length).toBe(COACH_TOOLS.length);
  });

  it("planAllowsTool suit la hiérarchie des plans", () => {
    expect(planAllowsTool("free", "find_trades")).toBe(true);
    expect(planAllowsTool("free", "annotate_trades")).toBe(false);
    expect(planAllowsTool("plus", "annotate_trades")).toBe(true);
    expect(planAllowsTool("premium", "annotate_trades")).toBe(true);
  });

  it("traite un outil inconnu comme de la lecture, sans planter", () => {
    expect(planAllowsTool("free", "outil_qui_nexiste_pas")).toBe(true);
  });

  it("renvoie des définitions d'outils intactes, utilisables par l'API", () => {
    for (const t of coachToolsForPlan("premium")) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(t.input_schema.type).toBe("object");
      // Aucun champ parasite : l'API rejette un objet outil non conforme.
      expect(Object.keys(t).sort()).toEqual(["description", "input_schema", "name"]);
    }
  });
});
