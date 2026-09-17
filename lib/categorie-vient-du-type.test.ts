import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATEGORIE_DE_VIOLATION,
  computeDisciplineScore,
  type Violation,
  type ViolationType,
} from "./discipline-score";

/**
 * LA CATÉGORIE D'UNE VIOLATION SE DÉDUIT DE SON TYPE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ `category` ÉTAIT LE SEUL CHAMP RECOPIÉ SANS FILET depuis la sortie du
 * modèle. Ses trois voisins en avaient chacun un (`trade_ids || []`,
 * `occurrences || 1`, `explanation || ""`) : une précaution écrite pour quatre
 * champs, appliquée à trois.
 *
 * ⚠️ ET LA CONSÉQUENCE N'ÉTAIT PAS UN AFFICHAGE DE TRAVERS, C'ÉTAIT UN
 * PLANTAGE. Ce champ sert d'INDEX : `categoryPenalties[v.category].push(...)`
 * lit `undefined.push` sur une valeur inconnue, donc lève. C'est un 500 sur la
 * route PAYANTE, et le crédit est déjà consommé quand il survient : c'est
 * exactement l'incident du 2026-08-03, sur la même route, par un autre champ.
 *
 * ⚠️ LE CAS LE PLUS PROBABLE N'EST MÊME PAS UNE HALLUCINATION : l'orthographe
 * britannique « behaviour » suffit, dans un prompt majoritairement français.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le type fait foi. Le modèle n'a plus à se prononcer sur la catégorie, et
 * aucune clé non validée ne sert d'index.
 */

const RACINE = process.cwd();

function violation(o: Partial<Violation>): Violation {
  return {
    category: "strategy",
    type: "fomo",
    trade_ids: [],
    occurrences: 1,
    explanation: "",
    ...o,
  } as Violation;
}

describe("le calcul du score de discipline", () => {
  it("ne lève pas sur une catégorie inconnue", () => {
    // ⚠️ La faute telle qu'elle arriverait : le type est bon, la catégorie non.
    const fautive = violation({ type: "fomo", category: "behaviour" as never });
    expect(() => computeDisciplineScore([fautive], 10)).not.toThrow();
  });

  it("ne lève pas sur une catégorie absente", () => {
    const sansCategorie = violation({ type: "revenge_trading", category: undefined as never });
    expect(() => computeDisciplineScore([sansCategorie], 10)).not.toThrow();
  });

  /**
   * ⚠️ ET ELLE COMPTE QUAND MÊME. Se contenter d'ignorer la violation aurait
   * REMONTÉ le score : une faute de frappe du modèle aurait récompensé le
   * trader, ce qui est pire qu'un plantage parce que personne ne le voit.
   */
  it("range la violation dans la bonne catégorie malgré l'étiquette fausse", () => {
    const r = computeDisciplineScore(
      [violation({ type: "fomo", category: "strategy", occurrences: 1 })],
      10,
    );
    const comportement = r.breakdown.find((b) => b.category === "behavior")!;
    expect(comportement.penalties.map((p) => p.type)).toContain("fomo");
    expect(comportement.totalRaw, "fomo ne coûte plus ses 10 points").toBe(10);
    const strategie = r.breakdown.find((b) => b.category === "strategy")!;
    expect(strategie.penalties, "la violation est restée dans la mauvaise colonne").toEqual([]);
    expect(r.score).toBe(90);
  });

  it("la table couvre exactement les types du barème, sans trou ni surplus", () => {
    const src = readFileSync(join(RACINE, "lib/discipline-score.ts"), "utf8");
    const duBareme = Array.from(
      src.matchAll(/^\s{2}([a-z_]+): \{ perOccurrence: \d+ \},$/gm),
    ).map((m) => m[1]);
    expect(duBareme.length, "le barème n'a pas été lu").toBeGreaterThanOrEqual(14);

    const deLaTable = Object.keys(CATEGORIE_DE_VIOLATION);
    expect(deLaTable.sort()).toEqual(duBareme.sort());

    // Et chaque valeur est une des trois colonnes, pas un mot libre.
    for (const [type, cat] of Object.entries(CATEGORIE_DE_VIOLATION)) {
      expect(["strategy", "behavior", "execution"], `${type} : catégorie inconnue`).toContain(cat);
    }
  });

  /**
   * ⚠️ LE BARÈME ET LES PLAFONDS SE RÉPONDENT : une catégorie sans plafond
   * ferait un `Math.min(total, undefined)` qui vaut NaN, donc un score NaN
   * affiché tel quel.
   */
  it("chaque catégorie de la table a un plafond", () => {
    const src = readFileSync(join(RACINE, "lib/discipline-score.ts"), "utf8");
    for (const cat of Array.from(new Set(Object.values(CATEGORIE_DE_VIOLATION)))) {
      expect(src, `plafond manquant pour ${cat}`).toMatch(new RegExp(`${cat}: \\d+`));
    }
    const r = computeDisciplineScore(
      Object.keys(CATEGORIE_DE_VIOLATION).map((t) => violation({ type: t as ViolationType })),
      50,
    );
    expect(Number.isNaN(r.score), "le score est NaN").toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe("la route d'analyse", () => {
  const route = () => readFileSync(join(RACINE, "app/api/analyze/route.ts"), "utf8");

  it("ne recopie plus la catégorie du modèle", () => {
    const src = route();
    expect(src, "la catégorie revient de la sortie du modèle").not.toMatch(
      /^\s+category: v\.category,$/m,
    );
    expect(src).toContain("category: CATEGORIE_DE_VIOLATION[v.type] ?? \"strategy\",");
  });

  /**
   * ⚠️ ET LE PROMPT ÉNUMÈRE LA RÈGLE QUE LE SERVEUR COMPTE. `max_daily_loss`
   * était demandé au modèle dans la liste « reprends nos occurrences » sans
   * figurer dans la liste des types possibles : on lui demandait de reprendre
   * un type qu'on ne lui avait jamais présenté.
   */
  it("le prompt présente tous les types que le serveur compte", () => {
    const src = route();
    const i = src.indexOf("TYPES DE VIOLATIONS POSSIBLES");
    expect(i, "la liste des types a disparu du prompt").toBeGreaterThan(0);
    const liste = src.slice(i, src.indexOf("EN PLUS DES VIOLATIONS", i));
    const manquants = Object.keys(CATEGORIE_DE_VIOLATION).filter(
      (t) => !liste.includes(`"${t}"`),
    );
    expect(
      manquants,
      "types absents de la liste du prompt : le modèle doit les reprendre sans " +
        "les avoir jamais vus : " + manquants.join(", "),
    ).toEqual([]);
  });
});
