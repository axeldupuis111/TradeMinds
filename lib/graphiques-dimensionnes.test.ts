import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CHAQUE GRAPHIQUE DÉCLARE SA TAILLE.
 *
 * ── LE DÉFAUT, LU DANS LA CONSOLE ───────────────────────────────────────────
 *
 * ⚠️⚠️ À CHAQUE OUVERTURE DU SUIVI DE COMPTE : « The width(-1) and height(-1)
 * of chart should be greater than 0 ». La courbe d'équité mesurait son
 * conteneur au premier rendu, pendant que la carte s'anime encore, et trouvait
 * -1 × -1. Résultat : un graphique vide le temps d'une image, et un
 * avertissement qui revient à chaque visite.
 *
 * ⚠️ C'ÉTAIT LE SEUL DES ONZE GRAPHIQUES À NE PAS DÉCLARER SA TAILLE. Les dix
 * autres passent `width` et `height` ; celui-ci s'en remettait au style de son
 * parent. La règle était donc établie, appliquée dix fois sur onze.
 *
 * ⚠️ ET LE BRUIT EST LE VRAI COÛT : une console qui avertit à chaque page est
 * une console qu'on cesse de lire, donc une vraie erreur qui passera inaperçue.
 * Ce test existe pour que la console reste silencieuse.
 */
describe("les graphiques déclarent leur taille", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /** L'index du `>` qui ferme une balise, accolades et guillemets comptés. */
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

  it("trouve bien les graphiques du produit", () => {
    let n = 0;
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      n += (readFileSync(chemin, "utf8").match(/<ResponsiveContainer\b/g) || []).length;
    }
    expect(n, "aucun graphique trouvé : le motif ne cherche rien").toBeGreaterThan(8);
  });

  it("chaque conteneur réactif déclare width et height", () => {
    const fautes: string[] = [];
    for (const chemin of [...fichiers("app"), ...fichiers("components")]) {
      const source = readFileSync(chemin, "utf8");
      const nom = chemin.split(/[\\/]/).slice(-2).join("/");
      for (const m of Array.from(source.matchAll(/<ResponsiveContainer\b/g))) {
        const fin = finDeBalise(source, m.index!);
        if (fin < 0) continue;
        const balise = source.slice(m.index!, fin + 1);
        const manque: string[] = [];
        if (!/\bwidth=/.test(balise)) manque.push("width");
        if (!/\bheight=/.test(balise)) manque.push("height");
        if (manque.length) {
          fautes.push(`${nom}:${source.slice(0, m.index!).split(/\r?\n/).length} sans ${manque.join(" ni ")}`);
        }
      }
    }
    expect(
      fautes,
      "graphiques qui s'en remettent à leur parent : " + fautes.join(", "),
    ).toEqual([]);
  });
});
