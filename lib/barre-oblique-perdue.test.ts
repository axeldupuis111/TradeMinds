import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UNE EXPRESSION RÉGULIÈRE ASSEMBLÉE NE PERD PAS SES BARRES OBLIQUES.
 *
 * ── LE DÉFAUT, ET IL VIENT DE L'OUTILLAGE, PAS DU PRODUIT ───────────────────
 *
 * ⚠️⚠️ DANS UN LITTÉRAL DE CHAÎNE, UNE BARRE OBLIQUE INVERSE SUIVIE DE « s »
 * NE DONNE PAS « espace », ELLE DONNE « s ». `new RegExp("a\s+b")` ne cherche
 * pas « a, des espaces, b » : il cherche « a », des « s », « b ». Le motif reste
 * parfaitement valide, il ne correspond simplement plus à ce qu'on croit.
 *
 * ⚠️ C'EST LE MÊME MODE DE PANNE QUE LES CARACTÈRES DE CONTRÔLE : le test ne dit
 * pas « je ne trouve rien », il dit « tout va bien ». C'est arrivé trois fois
 * dans ce dépôt, toujours sur un motif assemblé à partir d'une variable, donc
 * écrit en chaîne et non en littéral d'expression régulière.
 *
 * ⚠️ ET ÇA NE SE VOIT PAS À LA RELECTURE : les deux orthographes se ressemblent,
 * et celle qui est fausse est la plus courte, donc la plus naturelle à écrire.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Dans le premier argument de `new RegExp(…)`, une classe (`\s`, `\w`, `\d`,
 * `\b`, `\p`) s'écrit avec DEUX barres. Une seule est toujours une faute.
 */
describe("les motifs assemblés en chaîne", () => {
  /** Une barre oblique inverse, posée une fois pour ne pas la ré-échapper partout. */
  const BARRE = String.fromCharCode(92);

  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next" || f === ".git") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.(tsx?|mjs|js)$/.test(chemin)) out.push(chemin);
    }
    return out;
  }

  const tous = () =>
    ["app", "components", "lib", "scripts"].flatMap((d) => fichiers(join(process.cwd(), d)));

  /**
   * Le premier argument de `new RegExp(`, parenthèses équilibrées.
   *
   * ⚠️ ON S'ARRÊTE À LA VIRGULE DE PREMIER NIVEAU : le second argument porte les
   * drapeaux, et une virgule à l'intérieur d'un `{2,}` ne doit pas couper.
   */
  function premierArgument(src: string, depart: number): string {
    let prof = 1;
    let j = depart;
    let guillemet: string | null = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (guillemet) {
        if (c === guillemet && src[j - 1] !== BARRE) guillemet = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") guillemet = c;
      else if (c === "(") prof++;
      else if (c === ")") {
        prof--;
        if (prof === 0) break;
      } else if (c === "," && prof === 1) break;
    }
    return src.slice(depart, j);
  }

  it("sont bien assez nombreux pour que ce test prouve quelque chose", () => {
    let n = 0;
    for (const chemin of tous()) {
      n += (readFileSync(chemin, "utf8").match(/new RegExp\(/g) || []).length;
    }
    expect(n, "plus aucun motif assemblé : ce test ne cherche rien").toBeGreaterThan(10);
  });

  it("n'ont pas laissé le littéral manger leur barre oblique", () => {
    /**
     * Une barre SEULE (non précédée d'une autre) devant une lettre de classe.
     *
     * ⚠️ ET CE MOTIF-CI S'EST FAIT PRENDRE LE PREMIER : écrit avec une seule
     * barre, sa classe `[^ \ ]` échappait son propre crochet fermant, le groupe
     * ne se fermait plus là où je croyais, et il accusait les soixante-douze
     * motifs du dépôt d'une faute qu'aucun ne commettait. Il faut DEUX barres.
     */
    const perdue = new RegExp("(^|[^" + BARRE + BARRE + "])" + BARRE + BARRE + "([wsdbWSDBp])");
    const fautes: string[] = [];
    for (const chemin of tous()) {
      /**
       * ⚠️ LES COMMENTAIRES SONT BLANCHIS : ce fichier-ci décrit la faute pour
       * l'expliquer, et un garde qui lit les commentaires s'accuse lui-même.
       */
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      let i = -1;
      while ((i = src.indexOf("new RegExp(", i + 1)) !== -1) {
        const argument = premierArgument(src, i + "new RegExp(".length);
        const m = perdue.exec(argument);
        if (!m) continue;
        const ligne = src.slice(0, i).split(/\r?\n/).length;
        fautes.push(
          chemin.split(/[\\/]/).slice(-2).join("/") + ":" + ligne + " (" + BARRE + m[2] + ")",
        );
      }
    }
    expect(
      fautes,
      "motifs dont la barre oblique a été mangée par le littéral : " + fautes.join(", "),
    ).toEqual([]);
  });

  /**
   * ⚠️ GARDE SUR LE GARDE : le motif ci-dessus doit vraiment reconnaître la
   * faute. Sans ça, il suffirait qu'il se casse pour que le fichier passe au
   * vert en ne voyant plus rien, ce qui est exactement le défaut décrit en tête.
   */
  it("reconnaît la faute quand on la lui montre", () => {
    const perdue = new RegExp("(^|[^" + BARRE + BARRE + "])" + BARRE + BARRE + "([wsdbWSDBp])");
    expect(perdue.test('"a' + BARRE + 's+b"'), "la faute n'est pas vue").toBe(true);
    expect(perdue.test('"a' + BARRE + BARRE + 's+b"'), "l'orthographe correcte est accusée").toBe(
      false,
    );
  });
});
