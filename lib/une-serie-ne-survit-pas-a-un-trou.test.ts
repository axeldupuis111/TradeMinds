import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PERIODES_REMONTEES_MAX,
  clePrecedente,
  periodesEcoulees,
  reconduireLaSerie,
} from "./periode-objectif";

/**
 * UNE SÉRIE NE SURVIT PAS À UN TROU.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA RECONDUCTION D'UN OBJECTIF RÉCURRENT NE COMPTAIT PAS LES PÉRIODES
 * SAUTÉES. Elle comparait la clé de période stockée à celle du jour et, si
 * elles différaient, ajoutait UN à la série — que le silence ait duré une
 * semaine ou six mois. Un objectif hebdomadaire coché une fois puis laissé
 * cinq semaines rendait une série de deux : quatre semaines jamais tenues,
 * effacées sans trace.
 *
 * ⚠️ ET LA RECONDUCTION NE TOURNE QU'À LA VISITE DE LA PAGE. La série
 * récompensait donc la fréquence des visites plutôt que la discipline, ce qui
 * est l'inverse exact de ce que ce produit vend. C'est la même famille que la
 * clôture des défis hebdomadaires (lib/cloture-des-defis) : un mécanisme
 * périodique suspendu au passage de quelqu'un.
 *
 * ⚠️ MESURÉ EN BASE LE 2026-09-18 : six objectifs perso récurrents portent
 * encore la clé `2026-09-07` (la semaine passée) ou `2026-09-09`, personne ne
 * les ayant rouverts depuis.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * La série ne continue que si la période stockée est EXACTEMENT la précédente.
 * Le record, lui, garde ce qui a été réellement tenu : punir deux fois le même
 * oubli effacerait un acquis.
 */

const RACINE = process.cwd();

describe("la période précédente", () => {
  it("recule d'un jour, d'une semaine, d'un mois, d'un trimestre, d'une année", () => {
    expect(clePrecedente("day", "2026-09-18")).toBe("2026-09-17");
    expect(clePrecedente("week", "2026-09-14")).toBe("2026-09-07");
    expect(clePrecedente("month", "2026-09-01")).toBe("2026-08-01");
    expect(clePrecedente("quarter", "2026-07-01")).toBe("2026-04-01");
    expect(clePrecedente("year", "2026-01-01")).toBe("2025-01-01");
  });

  /** ⚠️ Et il passe l'année sans se tromper de mois. */
  it("franchit le passage d'année", () => {
    expect(clePrecedente("month", "2026-01-01")).toBe("2025-12-01");
    expect(clePrecedente("quarter", "2026-01-01")).toBe("2025-10-01");
    expect(clePrecedente("day", "2026-01-01")).toBe("2025-12-31");
  });
});

describe("les périodes écoulées", () => {
  it("rend zéro pour la même période", () => {
    expect(periodesEcoulees("week", "2026-09-14", "2026-09-14")).toBe(0);
  });

  /** ⚠️⚠️ LE CAS MESURÉ EN BASE : une clé restée à la semaine passée. */
  it("rend une pour la période immédiatement précédente", () => {
    expect(periodesEcoulees("week", "2026-09-07", "2026-09-14")).toBe(1);
    expect(periodesEcoulees("day", "2026-09-17", "2026-09-18")).toBe(1);
    expect(periodesEcoulees("month", "2026-08-01", "2026-09-01")).toBe(1);
  });

  /** ⚠️⚠️ LE CŒUR DU DÉFAUT : cinq semaines de silence sont cinq semaines. */
  it("compte les périodes sautées", () => {
    expect(periodesEcoulees("week", "2026-08-10", "2026-09-14")).toBe(5);
    expect(periodesEcoulees("day", "2026-09-09", "2026-09-18")).toBe(9);
    expect(periodesEcoulees("month", "2026-01-01", "2026-09-01")).toBe(8);
  });

  /** ⚠️ Une clé absente, hors grille ou dans le futur casse la chaîne. */
  it("refuse de deviner", () => {
    expect(periodesEcoulees("week", null, "2026-09-14")).toBe(PERIODES_REMONTEES_MAX);
    expect(periodesEcoulees("week", "", "2026-09-14")).toBe(PERIODES_REMONTEES_MAX);
    // Un mercredi, là où les clés de semaine sont des lundis.
    expect(periodesEcoulees("week", "2026-09-09", "2026-09-14")).toBe(PERIODES_REMONTEES_MAX);
    expect(periodesEcoulees("week", "2027-01-04", "2026-09-14")).toBe(PERIODES_REMONTEES_MAX);
  });

  /** ⚠️ Et la remontée est bornée : jamais toute l'histoire du compte. */
  it("s'arrête à la borne", () => {
    expect(periodesEcoulees("day", "2000-01-01", "2026-09-18")).toBe(PERIODES_REMONTEES_MAX);
    expect(periodesEcoulees("day", "2026-09-10", "2026-09-18", 3)).toBe(3);
  });
});

describe("la série à la reconduction", () => {
  /** La période précédente a été tenue : la série avance d'un cran. */
  it("avance quand la période juste avant a été tenue", () => {
    expect(reconduireLaSerie({ done: true, serie: 4, record: 6, ecoulees: 1 })).toEqual({
      serie: 5,
      record: 6,
    });
  });

  /**
   * ⚠️⚠️ LE DÉFAUT, REJOUÉ : coché une fois, puis cinq semaines de silence.
   * L'ancienne version rendait 5 ; la vérité est que la chaîne est rompue.
   */
  it("casse quand des périodes ont été sautées", () => {
    expect(
      reconduireLaSerie({ done: true, serie: 4, record: 6, ecoulees: 5 }).serie,
      "une série a survécu à quatre périodes jamais tenues",
    ).toBe(0);
  });

  /** ⚠️ Mais la période réellement tenue entre au record. */
  it("garde au record ce qui a été tenu, même si la chaîne casse ensuite", () => {
    expect(reconduireLaSerie({ done: true, serie: 4, record: 4, ecoulees: 9 }).record).toBe(5);
  });

  it("repart de zéro quand la période n'a pas été tenue", () => {
    expect(reconduireLaSerie({ done: false, serie: 7, record: 7, ecoulees: 1 })).toEqual({
      serie: 0,
      record: 7,
    });
  });
});

describe("la route des objectifs", () => {
  // ⚠️ Les commentaires DÉCRIVENT le défaut : les laisser ferait passer le
  // garde sur du code cassé. Ce dépôt a déjà payé ce piège trois fois.
  const src = readFileSync(join(RACINE, "app/api/goals/route.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  it("ne reconduit plus sur un simple changement de clé", () => {
    expect(src, "la série avance encore d'un cran sans compter le silence").not.toContain(
      "wasDone ? (g.streak ?? 0) + 1 : 0",
    );
    expect(src).toContain("reconduireLaSerie(");
    expect(src).toContain("periodesEcoulees(g.period, g.period_key, curKey)");
  });
});
