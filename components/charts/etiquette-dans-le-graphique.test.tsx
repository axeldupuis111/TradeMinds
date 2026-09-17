import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE ÉTIQUETTE DE GRAPHIQUE RESTE DANS LE GRAPHIQUE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ « position: right » POSE L'ÉTIQUETTE À DROITE DE LA LIGNE, DONC DEHORS.
 * Mesuré le 2026-09-18 en rendant la page Comptes dans un cadre de 390 px : le
 * texte « Départ recalé sur le solde du courtier » commence à x=310 et court
 * jusqu'à 482, alors que le graphique s'arrête à 315. Sur un téléphone, le
 * trader en voit cinq pixels.
 *
 * ⚠️ CE N'EST PAS UNE DÉCORATION : cette phrase explique POURQUOI la courbe
 * part de là plutôt que du capital de départ. Sans elle, la courbe a l'air
 * fausse.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Une étiquette de ligne de référence se pose À L'INTÉRIEUR de l'aire tracée.
 *
 * ⚠️ CE TEST NE REMPLACE PAS LA MESURE : il épingle la correction pour qu'elle
 * ne reparte pas. La vérité se lit dans le navigateur, sur le DOM rendu à
 * 390 px, et c'est comme ça que ce défaut a été trouvé.
 */

const RACINE = process.cwd();

function graphiques(d: string, out: string[] = []): string[] {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (statSync(p).isDirectory()) graphiques(p, out);
    else if (/\.tsx$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

describe("les étiquettes de lignes de référence", () => {
  it("ne se posent pas hors de l'aire tracée", () => {
    const fautes: string[] = [];
    for (const chemin of [
      ...graphiques(join(RACINE, "components/charts")),
      ...graphiques(join(RACINE, "components/analytics")),
    ]) {
      const src = readFileSync(chemin, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const m of Array.from(src.matchAll(/label=\{\{[^}]*position:\s*"(right|left|top|bottom)"/g))) {
        fautes.push(`${chemin.slice(RACINE.length + 1).replace(/\\/g, "/")} : position "${m[1]}"`);
      }
    }
    expect(
      fautes,
      "étiquettes posées à l'extérieur du graphique : sur un téléphone elles " +
        "sont coupées, et avec elles l'explication qu'elles portent :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  it("balaie bien des graphiques", () => {
    const n = graphiques(join(RACINE, "components/charts")).length;
    expect(n, "plus aucun graphique : le balayage est cassé").toBeGreaterThanOrEqual(3);
  });
});
