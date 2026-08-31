import { describe, expect, it } from "vitest";
import { fenetreDeTestSuggeree, MOIS_MIN_CONTROLE, periodeIntacte } from "./hors-periode";

const MIN = "2022-01";
const MAX = "2025-12";

describe("la période qui n'a pas servi à trouver le réglage", () => {
  it("rend les mois antérieurs quand le test part du milieu", () => {
    expect(periodeIntacte("2025-01", "2025-12", MIN, MAX)).toEqual({
      de: "2022-01",
      a: "2024-12",
      mois: 36,
    });
  });

  it("rend les mois postérieurs quand le test part du début", () => {
    expect(periodeIntacte("2022-01", "2023-12", MIN, MAX)).toEqual({
      de: "2024-01",
      a: "2025-12",
      mois: 24,
    });
  });

  it("garde la plus longue des deux fenêtres", () => {
    // Avant : 2022-01 → 2022-06, six mois. Après : 2023-01 → 2025-12, 36 mois.
    expect(periodeIntacte("2022-07", "2022-12", MIN, MAX)).toEqual({
      de: "2023-01",
      a: "2025-12",
      mois: 36,
    });
  });

  /**
   * ⚠️ LE CAS QUI DOIT DIRE NON. Un trader qui teste sur toute la profondeur
   * disponible n'a plus rien d'intact. Fabriquer une fenêtre qui chevauche
   * donnerait un contrôle qui valide toujours, c'est-à-dire pire que rien.
   */
  it("ne rend rien quand toute la période a servi", () => {
    expect(periodeIntacte(MIN, MAX, MIN, MAX)).toBeNull();
  });

  it("ne chevauche jamais la période testée", () => {
    for (const de of ["2022-01", "2023-05", "2024-11"]) {
      for (const a of ["2024-12", "2025-06", "2025-12"]) {
        const f = periodeIntacte(de, a, MIN, MAX);
        if (!f) continue;
        const avant = f.a < de;
        const apres = f.de > a;
        expect(avant || apres, `${f.de}-${f.a} chevauche ${de}-${a}`).toBe(true);
      }
    }
  });

  it("n'inclut pas le mois de bord, qui a servi au test", () => {
    const f = periodeIntacte("2025-01", "2025-12", MIN, MAX);
    expect(f?.a).not.toBe("2025-01");
    expect(f?.a).toBe("2024-12");
  });
});

/**
 * ⚠️ NÉ D'UNE IMPASSE VUE EN VRAI. Un trader avait testé sur les quatre ans
 * disponibles : plus aucune fenêtre intacte, donc plus de contrôle possible,
 * donc un bouton d'enregistrement gris pour toujours. Ce test garantit qu'il
 * existe toujours une sortie proposable.
 */
describe("la fenêtre de test à proposer quand tout a servi", () => {
  it("laisse une fenêtre intacte utilisable", () => {
    const suggestion = fenetreDeTestSuggeree(MIN, MAX);
    expect(suggestion).not.toBeNull();
    const intacte = periodeIntacte(suggestion!.de, suggestion!.a, MIN, MAX);
    expect(intacte).not.toBeNull();
    expect(intacte!.mois).toBeGreaterThanOrEqual(MOIS_MIN_CONTROLE);
  });

  it("garde le gros de la profondeur pour mesurer", () => {
    const s = fenetreDeTestSuggeree(MIN, MAX)!;
    // 48 mois au total : on en laisse 16 intacts et on en garde 32 pour tester.
    expect(s).toEqual({ de: "2023-05", a: "2025-12" });
  });

  it("laisse le passé lointain intact, pas le présent", () => {
    const s = fenetreDeTestSuggeree(MIN, MAX)!;
    expect(s.a).toBe(MAX);
    expect(s.de > MIN).toBe(true);
  });

  /**
   * ⚠️ Mieux vaut ne rien proposer que de proposer un contrôle qui répondra
   * « trop peu de trades » à coup sûr : ce serait l'apparence d'une
   * vérification, ce qui est pire que pas de vérification du tout.
   */
  it("ne propose rien quand les données sont trop courtes pour couper", () => {
    expect(fenetreDeTestSuggeree("2025-01", "2025-08")).toBeNull();
  });
});
