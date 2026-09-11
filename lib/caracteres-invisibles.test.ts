import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AUCUN CARACTÈRE DE CONTRÔLE NE SE CACHE DANS LE CODE.
 *
 * ── LE DÉFAUT, ET IL VENAIT DE MON OUTILLAGE ────────────────────────────────
 *
 * ⚠️⚠️ UN GARDE A CESSÉ DE VOIR QUOI QUE CE SOIT, SANS ÉCHOUER. En écrivant un
 * motif depuis une commande shell sous Windows, le `\b` d'une expression
 * régulière est devenu un vrai caractère « retour arrière » (0x08). Le fichier
 * compile, l'expression `/<(p|div|span)\x08/` est parfaitement valide, elle ne
 * correspond simplement plus jamais à rien : le garde a continué de passer au
 * vert en ne regardant plus aucune ligne.
 *
 * ⚠️ C'EST LE PIRE MODE DE PANNE POUR UN TEST : il ne dit pas « je ne trouve
 * rien », il dit « tout va bien ». Seul le compteur « j'ai bien balayé N cas »
 * l'a trahi, et c'est précisément pour ça que ces compteurs existent partout
 * dans ce dépôt.
 *
 * ⚠️ ET ÇA NE SE VOIT PAS À LA RELECTURE : `sed`, `cat` et l'éditeur affichent
 * le caractère comme s'il n'existait pas. Seul un balayage par code le montre.
 */
describe("les fichiers du dépôt", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next" || f === ".git") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.(tsx?|mjs|js|css)$/.test(chemin)) out.push(chemin);
    }
    return out;
  }

  const tous = () =>
    ["app", "components", "lib", "scripts", "i18n"].flatMap((d) => fichiers(join(process.cwd(), d)));

  it("balaie bien le dépôt, sinon ce test ne prouve rien", () => {
    expect(tous().length).toBeGreaterThan(300);
  });

  /**
   * ⚠️ ON LAISSE PASSER LA TABULATION, LE SAUT DE LIGNE ET LE RETOUR CHARIOT :
   * ce sont des caractères d'écriture normale. Tout le reste en dessous de
   * l'espace est un accident.
   */
  it("ne cachent aucun caractère de contrôle", () => {
    const fautes: string[] = [];
    for (const chemin of tous()) {
      const source = readFileSync(chemin, "utf8");
      for (let i = 0; i < source.length; i++) {
        const code = source.charCodeAt(i);
        if (code >= 32 || code === 9 || code === 10 || code === 13) continue;
        const ligne = source.slice(0, i).split(/\r?\n/).length;
        fautes.push(`${chemin.split(/[\\/]/).slice(-2).join("/")}:${ligne} (code ${code})`);
        break;
      }
    }
    expect(
      fautes,
      "caractères invisibles : un motif qui en contient un ne correspond plus à rien : " +
        fautes.join(" | "),
    ).toEqual([]);
  });
});
