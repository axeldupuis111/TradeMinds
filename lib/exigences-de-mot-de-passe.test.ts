import { describe, expect, it } from "vitest";
import { EXIGENCES_DE_MOT_DE_PASSE, isPasswordValid } from "./exigences-de-mot-de-passe";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";

/**
 * CE QUE L'ÉCRAN EXIGE EST CE QUE LE CODE APPLIQUE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️ LA LISTE AFFICHÉE ET LA LISTE APPLIQUÉE ÉTAIENT DEUX LISTES, dans le même
 * fichier, à vingt lignes d'écart : les quatre coches vertes venaient d'un
 * tableau, et `isPasswordValid` réécrivait les quatre mêmes conditions à la
 * main. Elles étaient d'accord, et rien ne les y obligeait.
 *
 * ⚠️ CE QUE ÇA AURAIT DONNÉ : une exigence ajoutée à l'affichage sans être
 * réécrite dans le validateur, c'est une coche grise sur un mot de passe
 * accepté ; l'inverse, c'est un refus sans explication sur un mot de passe que
 * l'écran déclare bon. Le second est le pire : l'inscription échoue et le
 * visiteur ne sait pas pourquoi.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une seule liste, et le test le prouve exigence par exigence.
 */

/** Un mot de passe qui satisfait TOUT sauf l'exigence visée. */
const CONTRE_EXEMPLES: Record<string, string> = {
  length: "Ab1defg", // 7 caractères
  lowercase: "ABCDEFG1",
  uppercase: "abcdefg1",
  digit: "Abcdefgh",
};

describe("les exigences du mot de passe", () => {
  it("sont bien au nombre de quatre", () => {
    expect(EXIGENCES_DE_MOT_DE_PASSE.length, "la liste a changé : revoir les contre-exemples").toBe(4);
  });

  it("acceptent un mot de passe qui les satisfait toutes", () => {
    expect(isPasswordValid("Abcdefg1")).toBe(true);
  });

  /**
   * ⚠️⚠️ LE CŒUR DU GARDE : chaque exigence AFFICHÉE doit être APPLIQUÉE, une à
   * une. Un test global (« un bon mot de passe passe ») ne verrait pas une
   * exigence affichée que personne n'applique.
   */
  it("sont toutes appliquées, une par une", () => {
    const non = EXIGENCES_DE_MOT_DE_PASSE.filter((e) => {
      const contre = CONTRE_EXEMPLES[e.key];
      if (contre === undefined) return false;
      // Le contre-exemple échoue à cette exigence...
      if (e.test(contre)) return true;
      // ...et le validateur doit donc le refuser.
      return isPasswordValid(contre);
    });
    expect(
      non.map((e) => e.key),
      "exigences montrées au visiteur et non appliquées (ou l'inverse) : " +
        non.map((e) => e.key).join(", "),
    ).toEqual([]);
  });

  it("ont chacune un contre-exemple, sinon ce test ne prouve rien", () => {
    const sansContre = EXIGENCES_DE_MOT_DE_PASSE.filter((e) => CONTRE_EXEMPLES[e.key] === undefined);
    expect(sansContre.map((e) => e.key), "exigence non éprouvée").toEqual([]);
  });

  /** ⚠️ Et chacune se dit dans les quatre langues : un visiteur doit LIRE la règle. */
  it("se disent dans les quatre langues", () => {
    const dicts: [string, Record<string, string>][] = [["fr", fr], ["en", en], ["de", de], ["es", es]];
    const fautes: string[] = [];
    for (const e of EXIGENCES_DE_MOT_DE_PASSE) {
      for (const [langue, dict] of dicts) {
        if (!dict[e.cle]) fautes.push(`${langue} : ${e.cle}`);
      }
    }
    expect(fautes, "exigences sans libellé : le visiteur verra la clé : " + fautes.join(", ")).toEqual([]);
  });
});
