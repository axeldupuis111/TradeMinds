import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";

/**
 * UN TABLEAU TROP LARGE SE FAIT DÉFILER, IL NE SE FAIT PAS COUPER.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE COMPARATIF DES FORMULES ÉTAIT AMPUTÉ SUR TÉLÉPHONE. Son conteneur
 * portait `overflow-hidden`, posé pour arrondir les coins. Mesuré sur le site
 * déployé : le tableau ne descend pas sous 389 px de large, pour 341 px de
 * place sur un écran de 375 px. Les 48 px qui dépassaient étaient coupés SANS
 * AUCUN MOYEN DE LES ATTEINDRE, et ils tombaient sur la colonne Premium. Sur
 * la page où l'on choisit ce qu'on paie, la formule la plus chère était
 * tronquée.
 *
 * ⚠️ SEIZE AUTRES TABLEAUX ÉTAIENT DÉJÀ DANS UN CONTENEUR QUI DÉFILE. Encore
 * une convention tenue seize fois sur dix-sept.
 *
 * ── CE QUE CE TEST TIENT ────────────────────────────────────────────────────
 *
 * ⚠️ `overflow-hidden` NE COMPTE PAS, et c'est tout l'objet : il ressemble à
 * une précaution alors qu'il supprime le contenu. Seul ce qui DÉFILE compte.
 */
describe("aucun tableau n'est coupé sans recours", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  function finDeBalise(src: string, depart: number): number {
    let prof = 0;
    let guillemet: string | null = null;
    for (let j = depart; j < src.length; j++) {
      const c = src[j];
      if (guillemet) {
        if (c === guillemet && src[j - 1] !== "\\") guillemet = null;
      } else if (c === '"' || c === "'" || c === "`") guillemet = c;
      else if (c === "{") prof++;
      else if (c === "}") prof--;
      else if (c === ">" && prof === 0) return j;
    }
    return -1;
  }

  /**
   * Les `<table>` d'un fichier, chacun avec la PILE des balises ouvertes
   * au-dessus de lui.
   *
   * ⚠️ UNE PILE, PAS UNE FENÊTRE DE CARACTÈRES. « Le conteneur est quelque part
   * dans les N caractères d'avant » attrape le voisin, ou rate le vrai parent
   * quand une carte s'intercale. On suit donc les ouvertures et les fermetures.
   */
  function tablesEtAncetres(src: string): { index: number; ancetres: string[] }[] {
    const res: { index: number; ancetres: string[] }[] = [];
    const pile: { nom: string; balise: string }[] = [];
    const re = /<\/?([A-Za-z][\w.-]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const ferme = src[m.index + 1] === "/";
      const nom = m[1];
      if (ferme) {
        for (let i = pile.length - 1; i >= 0; i--) {
          if (pile[i].nom === nom) {
            pile.length = i;
            break;
          }
        }
        continue;
      }
      const fin = finDeBalise(src, m.index);
      if (fin < 0) break;
      if (nom === "table") res.push({ index: m.index, ancetres: pile.map((p) => p.balise) });
      if (src[fin - 1] !== "/") pile.push({ nom, balise: src.slice(m.index, fin + 1) });
      re.lastIndex = fin;
    }
    return res;
  }

  it("la sonde suit bien l'imbrication", () => {
    const src = `<div className="overflow-x-auto"><div><table></table></div></div><table></table>`;
    const t = tablesEtAncetres(src);
    expect(t).toHaveLength(2);
    expect(t[0].ancetres.join(" ")).toContain("overflow-x-auto");
    // ⚠️ Le second est SORTI du conteneur : une fermeture le referme vraiment.
    expect(t[1].ancetres.join(" ")).not.toContain("overflow-x-auto");
  });

  it("chaque tableau vit dans un conteneur qui défile", () => {
    const fautes: string[] = [];
    let vues = 0;
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const src = sansCommentaires(readFileSync(chemin, "utf8"));
      for (const t of tablesEtAncetres(src)) {
        vues++;
        if (t.ancetres.some((b) => /overflow-x-auto|overflow-auto|overflow-x-scroll/.test(b))) continue;
        const ligne = src.slice(0, t.index).split(/\r?\n/).length;
        fautes.push(`${chemin.split(/[\\/]/).slice(-2).join("/")}:${ligne}`);
      }
    }
    expect(vues, "aucun tableau trouvé : la sonde ne cherche rien").toBeGreaterThan(10);
    expect(fautes, "tableaux coupés sur écran étroit : " + fautes.join(", ")).toEqual([]);
  });
});
