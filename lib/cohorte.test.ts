import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cohorteTronquee, dansLaCohorte, tousUtilisateurs } from "./cohorte";
import { sansCommentaires } from "./sans-commentaires";

describe("les étapes du tunnel", () => {
  const co = new Set(["a", "b", "c"]);

  it("ne comptent que les inscrits de la fenêtre", () => {
    const evenements = [
      { user_id: "a" },
      { user_id: "z" }, // inscrit avant la fenêtre : actif, mais hors cohorte
      { user_id: "b" },
    ];
    expect(dansLaCohorte(evenements, co)).toBe(2);
    // Le défaut d'origine, pour mémoire : il comptait 3.
    expect(tousUtilisateurs(evenements)).toBe(3);
  });

  it("comptent des personnes, pas des gestes", () => {
    const dixImports = Array.from({ length: 10 }, () => ({ user_id: "a" }));
    expect(dansLaCohorte(dixImports, co)).toBe(1);
    expect(tousUtilisateurs(dixImports)).toBe(1);
  });

  it("survivent à une lecture vide ou absente", () => {
    expect(dansLaCohorte(null, co)).toBe(0);
    expect(dansLaCohorte(undefined, co)).toBe(0);
    expect(dansLaCohorte([], co)).toBe(0);
  });

  it("valent zéro quand la cohorte est vide, jamais le total", () => {
    // ⚠️ Sans inscrit dans la fenêtre, aucune étape n'a de sens : le piège
    // serait de retomber sur « tous les utilisateurs » faute de filtre.
    expect(dansLaCohorte([{ user_id: "z" }], new Set())).toBe(0);
  });
});

describe("le plafond silencieux de la base", () => {
  it("se voit quand la liste est plus courte que le comptage", () => {
    expect(cohorteTronquee(1500, 1000)).toBe(true);
  });

  it("ne crie pas quand tout est arrivé", () => {
    expect(cohorteTronquee(21, 21)).toBe(false);
    expect(cohorteTronquee(0, 0)).toBe(false);
  });

  it("ne confond pas un comptage raté avec une troncature", () => {
    /**
     * `count` est nul quand la requête échoue : ce n'est pas une troncature, et
     * l'annoncer comme telle enverrait chercher le mauvais problème.
     *
     * ⚠️ HONNÊTETÉ SUR CE QUE CE TEST PROTÈGE : retirer le garde explicite de
     * `cohorteTronquee` ne le fait PAS échouer, parce que `null > 0` vaut déjà
     * `false` par coercition. Le garde existe pour que l'intention se lise, pas
     * parce que le comportement en dépend. Ce test fixe le comportement ; il ne
     * prouve rien sur la ligne qui l'exprime. Quelqu'un qui trouvera cette
     * ligne redondante doit savoir qu'il la supprimera sans filet.
     */
    expect(cohorteTronquee(null, 0)).toBe(false);
    expect(cohorteTronquee(undefined, 0)).toBe(false);
  });
});

describe("la route du tunnel admin", () => {
  const route = sansCommentaires(
    readFileSync(join(process.cwd(), "app/api/admin/funnel/route.ts"), "utf8"),
  );

  /**
   * ⚠️ Le calcul juste ne sert à rien s'il n'est pas BRANCHÉ. On vérifie donc
   * que les trois étapes passent par le filtre de cohorte, une par une : un
   * garde qui se contente de trouver « dansLaCohorte » quelque part laisserait
   * deux étapes sur trois revenir au comptage global.
   */
  for (const etape of ["activated", "analyzed", "checkoutStarted"]) {
    it(`${etape} passe par la cohorte`, () => {
      expect(
        route,
        `l'étape ${etape} ne filtre plus sur la cohorte : le pourcentage affiché ` +
          `mélange les inscrits de la fenêtre et les utilisateurs actifs venus d'avant`,
      ).toMatch(new RegExp(etape + ":\\s*dansLaCohorte\\("));
    });
  }

  it("garde l'activité globale à part, sans la confondre avec une étape", () => {
    expect(route, "activatedAllUsers a disparu").toMatch(/activatedAllUsers:/);
  });

  it("ne rapporte aucune étape à une autre étape", () => {
    /**
     * ⚠️⚠️ LES ÉTAPES NE SONT PAS EMBOÎTÉES. On peut démarrer un checkout sans
     * avoir lancé d'analyse : le mur de paiement s'atteint aussi depuis la page
     * des tarifs. Rapporter une étape à la précédente donne donc un taux qui ne
     * veut rien dire, et le 2026-09-12 l'écran affichait « checkout démarré :
     * 200 % » en production.
     *
     * Un taux au-dessus de 100 se voit. Le même calcul, sur des étapes proches,
     * produit un taux faux que personne ne remarque : c'est pour ça que la
     * règle porte sur le CALCUL et pas sur le résultat.
     */
    const page = sansCommentaires(
      readFileSync(join(process.cwd(), "app/dashboard/admin/page.tsx"), "utf8"),
    );
    for (const etape of ["activated", "analyzed", "checkoutStarted"]) {
      expect(
        page,
        `une étape du tunnel se rapporte à funnel.${etape} : les étapes ne ` +
          `s'enchaînent pas, ce pourcentage peut dépasser 100 % et ne veut rien dire`,
      ).not.toContain("base: funnel." + etape);
    }
  });

  it("signale une cohorte tronquée", () => {
    expect(route, "le plafond silencieux de PostgREST n'est plus détecté").toMatch(
      /cohorteTronquee/,
    );
  });
});
