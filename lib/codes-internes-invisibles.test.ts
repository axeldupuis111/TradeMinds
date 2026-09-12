import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIBELLE_DE_VIOLATION, sansCodesInternes } from "./analysis-selection";

/**
 * UN CODE INTERNE NE SORT JAMAIS SOUS LES YEUX DU TRADER.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE TABLEAU DE BORD AFFICHAIT : « La violation missing_tp récidive pour la
 * 3e analyse consécutive (12 occurrences le mois dernier) ». Sur la carte
 * « Insights IA », en page d'accueil du produit.
 *
 * ⚠️ LE MODÈLE N'A RIEN INVENTÉ. Le prompt d'analyse lui donne les codes, et il
 * en a BESOIN : c'est la clé qu'il doit remettre dans `violations[].type`. Rien
 * ne lui interdisait de les réutiliser dans une phrase.
 *
 * ⚠️ ET CETTE PHRASE EST ENREGISTRÉE. Une règle de prompt seule laisserait les
 * analyses déjà en base afficher leur code jusqu'à la prochaine analyse. D'où
 * les DEUX côtés : le prompt pour ce qui s'écrira, le nettoyage à l'affichage
 * pour ce qui est écrit.
 *
 * ⚠️ C'est la troisième fois que ce dépôt paie cette forme : `sync_cooldown`
 * affiché tel quel sur les réglages, `consecutive_losses` dans la bouche du
 * coach, `missing_tp` ici. Un identifiant technique finit sous les yeux d'un
 * humain dès qu'on oublie de le traduire à UN endroit.
 */
describe("les codes internes", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

  it("sont remplacés par leur nom lisible dans un texte rédigé", () => {
    const brut =
      "La violation missing_tp récidive pour la 3e analyse, et sl_too_wide revient aussi.";
    const propre = sansCodesInternes(brut);
    expect(propre, "le code passe encore").not.toMatch(/missing_tp|sl_too_wide/);
    expect(propre).toContain(LIBELLE_DE_VIOLATION.missing_tp);
    expect(propre).toContain(LIBELLE_DE_VIOLATION.sl_too_wide);
    // Le reste de la phrase est intact.
    expect(propre).toContain("récidive pour la 3e analyse");
  });

  /**
   * ⚠️ MOTS ENTIERS SEULEMENT. Sans la frontière, `missing_tp` mangerait le
   * début de `missing_tpx` et on remplacerait la moitié d'un autre mot.
   */
  it("ne touchent pas un mot qui les contient", () => {
    expect(sansCodesInternes("missing_tpx")).toBe("missing_tpx");
    expect(sansCodesInternes("pre_missing_tp")).toBe("pre_missing_tp");
  });

  it("laissent un texte sans code exactement tel quel", () => {
    const texte = "Trois pertes d'affilée, avec un SL plus large que d'habitude.";
    expect(sansCodesInternes(texte)).toBe(texte);
  });

  /**
   * ⚠️ LE NETTOYAGE SE FAIT AU SEUL ENDROIT D'OÙ SORT LA PAGE, pas aux douze
   * endroits de rendu : en nettoyer douze, c'est en oublier un.
   */
  it("sont nettoyés là où l'analyse est affichée", () => {
    const page = lire("app/dashboard/analysis/page.tsx");
    expect(page, "l'analyse affichée n'est plus nettoyée").toContain(
      "nettoyerLAnalyse(analysis)",
    );
    for (const champ of ["headline", "summary", "strengths", "recommendations", "patterns"]) {
      expect(page, `${champ} n'est pas nettoyé`).toMatch(new RegExp(champ + ":"));
    }
    const dash = lire("components/dashboard/DashboardContent.tsx");
    // ⚠️ Le nettoyage porte DEUX règles depuis qu'on y a joint les tirets
    // longs : on vérifie qu'il passe, pas la forme exacte de l'appel.
    expect(dash, "les insights du tableau de bord ne sont pas nettoyés").toContain(
      "sansCodesInternes(x)",
    );
  });

  /**
   * ⚠️ ET LE PROMPT LE DIT, sinon on nettoie indéfiniment ce qu'on continue de
   * produire. Le champ `type` garde son code : c'est une clé, pas une phrase.
   */
  it("sont interdits dans la prose par le prompt d'analyse", () => {
    const route = lire("app/api/analyze/route.ts");
    expect(route).toContain("CES NOMS SONT DES CLÉS, PAS DES MOTS");
    expect(route, "le prompt n'interdit pas les codes en prose").toMatch(
      /N'en écris JAMAIS un seul dans une phrase rédigée/,
    );
  });

  /**
   * ⚠️ GARDE SUR LE GARDE : la table des libellés doit couvrir TOUS les types
   * mécaniques. Un type sans libellé traverserait le nettoyage intact.
   */
  it("ont tous un nom lisible", () => {
    const src = lire("lib/analysis-selection.ts");
    /**
     * ⚠️ ON COUPE AU POINT-VIRGULE QUI FERME L'ALIAS, pas à quatre cents
     * caractères : la fenêtre débordait sur la déclaration suivante et ce test
     * exigeait un libellé pour « execution », qui est une catégorie et pas un
     * type. Une fenêtre n'est toujours pas une frontière.
     */
    const debut = src.indexOf("export type MechanicalViolationType");
    const bloc = src.slice(debut, src.indexOf(";", debut));
    const types = Array.from(bloc.matchAll(/\|\s*"(\w+)"/g)).map((m) => m[1]);
    expect(types.length, "aucun type trouvé : le motif ne cherche rien").toBeGreaterThan(5);
    for (const type of types) {
      expect(
        (LIBELLE_DE_VIOLATION as Record<string, string>)[type],
        `${type} n'a pas de nom lisible : il sortirait tel quel`,
      ).toBeTruthy();
    }
  });
});
