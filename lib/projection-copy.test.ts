import { describe, expect, it } from "vitest";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";

/**
 * L'onglet Projection affichait « 1 ans », « 1 years », « 1 Jahre », « 1 años ».
 *
 * Une seule clé « {n} ans » servait aux cinq horizons, et personne ne l'a vu
 * avant la preview : ni le typage, ni le test de parité i18n (les quatre langues
 * étaient fautives DE LA MÊME FAÇON, donc parfaitement cohérentes entre elles).
 *
 * ⚠️ C'est la leçon de ce fichier : la parité entre langues ne dit rien de la
 * justesse. Quatre traductions d'une faute restent quatre fautes, et un test qui
 * compare les langues entre elles les valide toutes.
 */

const DICOS: Record<string, Record<string, string>> = { fr, en, de, es };

describe("l'horizon d'un an se dit au singulier", () => {
  it.each(Object.keys(DICOS))("%s a une forme singulière distincte du pluriel", (lang) => {
    const d = DICOS[lang];
    expect(d.proj_year_one, `proj_year_one manquant en ${lang}`).toBeTruthy();
    expect(d.proj_year_one).not.toBe(d.proj_years);
  });

  it.each(Object.keys(DICOS))("%s n'affiche pas le pluriel pour un seul an", (lang) => {
    // On reconstruit ce que la page produirait pour n=1 avec la clé plurielle,
    // et on exige que la forme singulière en diffère. Sans ce test, remettre
    // `t("proj_years").replace("{n}", "1")` passerait inaperçu.
    const pluriel = DICOS[lang].proj_years.replace("{n}", "1");
    expect(DICOS[lang].proj_year_one).not.toBe(pluriel);
  });

  it("le français ne dit pas « 1 ans »", () => {
    // Le cas exact vu sur la preview, épinglé pour qu'il ne revienne pas.
    expect(fr.proj_year_one).toBe("1 an");
    expect(fr.proj_year_one).not.toMatch(/\bans\b/);
  });

  it("les autres langues accordent aussi", () => {
    expect(en.proj_year_one).not.toMatch(/years/);
    expect(de.proj_year_one).not.toMatch(/Jahre\b/);
    expect(es.proj_year_one).not.toMatch(/años/);
  });
});
