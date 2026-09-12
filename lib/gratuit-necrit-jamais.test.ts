import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_MIN_PLAN } from "./coach-tool-plans";
import { coachToolsForPlan } from "./coach-tools";
import { sansCommentaires } from "./sans-commentaires";

/**
 * « FREE : 14 TOOLS, READ ONLY. IT ANSWERS AND COMPUTES, BUT WRITES NOTHING. »
 *
 * C'est écrit sur la page d'accueil, dans la grille des tarifs. C'est aussi la
 * doctrine de `coach-tool-plans.ts` : le gratuit vend le DIAGNOSTIC, les plans
 * payants vendent le TRAITEMENT.
 *
 * ── POURQUOI UN GARDE MÉCANIQUE ─────────────────────────────────────────────
 *
 * ⚠️⚠️ LE DÉFAUT DE CETTE TABLE OUVRE, IL NE FERME PAS. Son propre commentaire
 * le dit : « un outil absent de cette table est traité comme `free` ». Un outil
 * d'écriture ajouté au catalogue et oublié dans la table devient donc GRATUIT,
 * en silence, et la phrase de la page d'accueil devient fausse.
 *
 * ⚠️ Le garde qui existait vérifiait une LISTE DE CINQ NOMS écrite à la main
 * (`annotate_trades`, `create_goal`…). Il protégeait ces cinq-là et rien
 * d'autre : le sixième outil d'écriture, celui qui n'existe pas encore, passait
 * au travers. Ce fichier ne lit aucune liste : il regarde ce que chaque branche
 * d'exécution FAIT réellement.
 */
describe("le coach du plan gratuit", () => {
  const src = sansCommentaires(
    readFileSync(join(process.cwd(), "lib/coach-tools.ts"), "utf8"),
  );

  /** Le corps de la branche `case "<nom>":` dans executeCoachTool. */
  function corpsDuCas(nom: string): string | null {
    const debut = src.indexOf(`case "${nom}":`);
    if (debut < 0) return null;
    const suivant = src.indexOf('case "', debut + 10);
    return src.slice(debut, suivant < 0 ? src.length : suivant);
  }

  /** Une opération qui modifie la base. */
  const ECRITURE = /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/;

  it("le détecteur d'écriture voit bien une écriture", () => {
    /**
     * ⚠️⚠️ GARDE-FOU DU GARDE-FOU. Tout ce test repose sur la capacité à
     * reconnaître une écriture dans le code. Si le découpage ou le motif
     * cessaient de fonctionner, la vérification ci-dessous deviendrait verte en
     * ne regardant plus rien, ce qui est pire que pas de test.
     */
    const ecrivain = corpsDuCas("annotate_trades");
    expect(ecrivain, "annotate_trades introuvable : le découpage a changé").not.toBeNull();
    expect(
      ECRITURE.test(ecrivain as string),
      "le motif ne reconnaît plus une écriture pourtant présente",
    ).toBe(true);

    const lecteur = corpsDuCas("list_goals");
    expect(lecteur, "list_goals introuvable").not.toBeNull();
    expect(
      ECRITURE.test(lecteur as string),
      "le motif voit une écriture dans un outil de lecture : il est trop large",
    ).toBe(false);
  });

  it("n'écrit jamais, quel que soit l'outil", () => {
    const gratuits = coachToolsForPlan("free").map((t) => t.name);
    expect(gratuits.length, "le catalogue gratuit s'est vidé").toBeGreaterThan(10);

    const fautifs: string[] = [];
    for (const nom of gratuits) {
      const corps = corpsDuCas(nom);
      if (corps && ECRITURE.test(corps)) {
        fautifs.push(`${nom} (${(corps.match(ECRITURE) ?? [""])[0]})`);
      }
    }
    expect(
      fautifs,
      "un outil du plan GRATUIT écrit en base. La page d'accueil promet " +
        "« read only, writes nothing » dans sa grille des tarifs, et la doctrine " +
        "du produit est que le gratuit mesure et que le payant change. Outils : " +
        fautifs.join(", "),
    ).toEqual([]);
  });

  it("aucun outil du catalogue n'échappe au classement", () => {
    /**
     * ⚠️ C'est la porte par laquelle un outil d'écriture deviendrait gratuit :
     * non pas en étant classé `free`, mais en n'étant pas classé du tout.
     */
    const tous = coachToolsForPlan("premium").map((t) => t.name);
    const absents = tous.filter((n) => !(n in TOOL_MIN_PLAN));
    expect(
      absents,
      "outils non classés, donc GRATUITS par défaut : " + absents.join(", "),
    ).toEqual([]);
  });
});
