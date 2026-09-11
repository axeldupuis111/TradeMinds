import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN GARDE NE DOIT PAS DÉPENDRE DE LA FIN DE LIGNE DE LA COPIE DE TRAVAIL.
 *
 * ── LE DÉFAUT, VU AU PIRE MOMENT ────────────────────────────────────────────
 *
 * ⚠️⚠️ LA SUITE EST PASSÉE DU VERT AU ROUGE SUR UN CODE IDENTIQUE, au moment
 * exact du `git checkout main` qui précédait le merge. Git réécrit la copie de
 * travail en CRLF à ce moment-là ; un garde qui cherchait la fin d'un type par
 * `src.indexOf("\n\n")` n'a alors plus rien trouvé, `indexOf` a rendu -1, le
 * `slice` a emporté tout le module, et le test a comparé seize opérations à
 * quarante-cinq, doublons compris.
 *
 * ⚠️ CE GARDE-LÀ AVAIT DONC TOUJOURS ÉTÉ FAUX, et il a passé des semaines
 * uniquement parce que la copie de travail était en LF. Un test qui dépend de
 * la façon dont git a détendu les fins de ligne ne teste pas le produit.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Chercher une LIGNE VIDE dans une source lue depuis le disque se fait avec un
 * motif qui tolère le retour chariot. Compter des lignes avec `split("\n")`
 * reste juste (le nombre de morceaux ne change pas) : ce n'est pas visé.
 */
describe("les gardes qui lisent le dépôt", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.test\.tsx?$/.test(chemin)) out.push(chemin);
    }
    return out;
  }

  const tests = () =>
    ["lib", "components", "app"].flatMap((d) => fichiers(join(process.cwd(), d)));

  it("balaie bien des tests, sinon celui-ci ne prouve rien", () => {
    const lecteurs = tests().filter((c) => /readFileSync/.test(readFileSync(c, "utf8")));
    expect(lecteurs.length).toBeGreaterThan(20);
  });

  /**
   * ⚠️ ON NE VISE QUE LA RECHERCHE D'UNE LIGNE VIDE, c'est-à-dire la frontière.
   * `split("\n")` employé pour compter un numéro de ligne rend le même compte
   * en CRLF : l'interdire ferait un garde qu'on apprend à contourner.
   */
  it("aucun ne cherche une ligne vide en supposant la fin de ligne", () => {
    const NU = ['"\\n\\n"', "'\\n\\n'", "`\\n\\n`"];
    const fautes: string[] = [];
    for (const chemin of tests()) {
      const brut = readFileSync(chemin, "utf8");
      if (!/readFileSync/.test(brut)) continue;
      brut.split(/\r?\n/).forEach((ligne, i) => {
        if (ligne.trimStart().startsWith("*") || ligne.trimStart().startsWith("//")) return;
        if (NU.some((m) => ligne.includes(m))) {
          fautes.push(`${chemin.split(/[\\/]/).slice(-2).join("/")}:${i + 1}`);
        }
      });
    }
    expect(
      fautes,
      "frontière cherchée sur « \\n\\n » : muette dès que la copie est en CRLF : " +
        fautes.join(" | "),
    ).toEqual([]);
  });
});
