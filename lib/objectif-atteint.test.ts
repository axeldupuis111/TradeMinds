import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { objectifAtteint } from "./objectif-atteint";

/**
 * « ATTEINT » VEUT DIRE LA MÊME CHOSE PARTOUT.
 *
 * ⚠️⚠️ L'ANNEAU DE LA PAGE OBJECTIFS ANNONÇAIT « 2/5 » PENDANT QUE LA PUCE D'À
 * CÔTÉ DISAIT « 5 EN COURS ». Mesuré le 2026-09-15 sur un compte sans un seul
 * trade du mois : « pertes consécutives ≤ 2 » et « trades par jour ≤ 3 » étaient
 * comptés comme gagnés parce que leur valeur valait zéro.
 *
 * La règle « sans activité, pas de verdict » était écrite, juste, et appliquée
 * par `goalStatus` seul. Trois autres endroits lisaient `met` tout cru : le
 * compteur de l'anneau, le pont vers le bilan mensuel, et les CONFETTIS.
 */
describe("un objectif atteint", () => {
  it("ne se déclare pas gagné sur une période sans activité", () => {
    // Le cas mesuré : un plafond respecté parce que rien ne s'est passé.
    expect(objectifAtteint({ kind: "metric", met: true, hadData: false })).toBe(false);
    expect(objectifAtteint({ kind: "metric", met: true, hadData: true })).toBe(true);
  });

  it("reste compatible avec une réponse servie avant le champ", () => {
    // `hadData` absent : on ne rétrograde pas un objectif pour une raison technique.
    expect(objectifAtteint({ kind: "metric", met: true })).toBe(true);
    expect(objectifAtteint({ kind: "metric", met: false })).toBe(false);
  });

  it("juge un objectif personnel sur la case cochée, sans condition d'activité", () => {
    // Un objectif écrit à la main (« relire mon plan ») n'a pas de données à
    // avoir : c'est le trader qui le coche.
    expect(objectifAtteint({ kind: "custom", done: true, hadData: false })).toBe(true);
    expect(objectifAtteint({ kind: "custom", done: false })).toBe(false);
  });

  /**
   * ⚠️ ET LES TROIS APPELANTS PASSENT PAR ICI. Sans ce test, un retour à
   * `filter((g) => g.met)` repasserait au vert partout : le défaut ne se voit
   * que sur un compte inactif, c'est-à-dire précisément celui qu'aucun test ne
   * simule.
   */
  it("est la seule règle employée par les écrans qui comptent des objectifs", () => {
    const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");

    const objectifs = lire("app/dashboard/goals/page.tsx");
    expect(objectifs, "l'anneau recompte à sa façon").toContain(
      "const achieved = goals.filter(objectifAtteint).length;",
    );
    expect(objectifs, "les confettis partent encore sur `met` brut").toContain(
      "metric.some((g) => objectifAtteint(g) && prev[g.id] === false)",
    );
    expect(objectifs, "l'instantané des félicitations garde l'ancienne règle").toContain(
      "snapshot[g.id] = objectifAtteint(g)",
    );

    const bilan = lire("app/dashboard/review/page.tsx");
    expect(bilan, "le bilan mensuel recompte à sa façon").toContain(
      "monthly.filter(objectifAtteint).length",
    );
  });
});
