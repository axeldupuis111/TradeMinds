import { describe, expect, it } from "vitest";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";
import { remplir } from "./remplir";

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
 *
 * ── CE TEST A CHANGÉ DE PRISE, PAS DE PROMESSE ──────────────────────────────
 *
 * ⚠️⚠️ IL VÉRIFIAIT L'EXISTENCE D'UNE CLÉ SŒUR, `proj_year_one`, parce que
 * c'est ainsi que le singulier était obtenu à l'époque : un ternaire dans la
 * page. Le produit accorde désormais ses phrases lui-même
 * (« {n} {n|an|ans} »), la sœur a disparu du code, et ce test continuait de
 * réclamer une clé que plus personne n'affichait : il gardait le MOYEN au lieu
 * de garder le RÉSULTAT.
 *
 * ⚠️ IL REGARDE MAINTENANT LA PHRASE RENDUE, ce qui est à la fois plus proche
 * de l'écran et plus difficile à contourner : remettre un gabarit sans accord
 * le fait échouer, quelle que soit la mécanique employée.
 */

const DICOS: Record<string, Record<string, string>> = { fr, en, de, es };

describe("l'horizon d'un an se dit au singulier", () => {
  it.each(Object.keys(DICOS))("%s distingue un an de plusieurs", (lang) => {
    const d = DICOS[lang];
    expect(d.proj_years, `proj_years manquant en ${lang}`).toBeTruthy();
    const un = remplir(d.proj_years, { n: 1 }, lang);
    const plusieurs = remplir(d.proj_years, { n: 3 }, lang);
    expect(un, `${lang} : aucun accord, « 1 » et « 3 » donnent la même forme`)
      .not.toBe(plusieurs.replace("3", "1"));
  });

  it.each(Object.keys(DICOS))("%s ne laisse aucun gabarit à l'écran", (lang) => {
    for (const n of [0, 1, 2, 5]) {
      const rendu = remplir(DICOS[lang].proj_years, { n }, lang);
      expect(rendu, `${lang} à n=${n}`).not.toMatch(/[{}|]/);
      expect(rendu).toContain(String(n));
    }
  });

  it("le français ne dit pas « 1 ans »", () => {
    // Le cas exact vu sur la preview, épinglé pour qu'il ne revienne pas.
    expect(remplir(fr.proj_years, { n: 1 }, "fr")).toBe("1 an");
    /** ⚠️ Et zéro prend le singulier en français, ce que l'anglais ne fait pas. */
    expect(remplir(fr.proj_years, { n: 0 }, "fr")).toBe("0 an");
    expect(remplir(fr.proj_years, { n: 3 }, "fr")).toBe("3 ans");
  });

  it("les autres langues accordent aussi", () => {
    expect(remplir(en.proj_years, { n: 1 }, "en")).not.toMatch(/years/);
    expect(remplir(de.proj_years, { n: 1 }, "de")).not.toMatch(/Jahre\b/);
    expect(remplir(es.proj_years, { n: 1 }, "es")).not.toMatch(/años/);
    expect(remplir(en.proj_years, { n: 4 }, "en")).toMatch(/years/);
    expect(remplir(de.proj_years, { n: 4 }, "de")).toMatch(/Jahre\b/);
    expect(remplir(es.proj_years, { n: 4 }, "es")).toMatch(/años/);
  });
});
