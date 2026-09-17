import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PERSONNE N'ÉCRIT ZÉRO À LA PLACE D'UN PRIX INCONNU.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE PRODUIT SE DÉFENDAIT DES ZÉROS À LA LECTURE, ET CONTINUAIT DE LES
 * ÉCRIRE. `lib/prix-connu.ts` existe depuis la veille parce que `exit_price = 0`
 * envoyait au modèle « Pips réalisés: 45000 (gain) | Résultat: LOSS | P&L net:
 * -50.00 ». Mais la source n'avait pas été touchée : le formulaire de saisie
 * manuelle écrivait `parseFloat(form.exit_price) || 0`, et le journal de séance
 * écrivait `exit_price: 0` en toutes lettres.
 *
 * ⚠️ MESURÉ EN BASE le 2026-09-18 : 122 trades portent `exit_price = 0`, TOUS
 * clos, TOUS avec un P&L non nul, TOUS de source « manual ». Aucun ne vaut
 * réellement zéro : c'est un champ laissé vide.
 *
 * ⚠️ LA COLONNE EST NULLABLE (vérifié sur le schéma réel servi par PostgREST) :
 * rien n'obligeait à inventer un nombre.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un prix qu'on ne connaît pas s'écrit `null`. `|| 0` sur un prix est un
 * mensonge, et `?? 0` aussi.
 */

const RACINE = process.cwd();

function sources(d: string, out: string[] = []): string[] {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(e.name)) continue;
    const p = join(d, e.name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Les champs dont zéro n'est pas une valeur possible ET dont la colonne accepte
 * `null`.
 *
 * ⚠️ `entry_price` ET `lot_size` N'Y SONT PAS, et ce n'est pas un oubli : ils
 * sont NOT NULL au schéma. L'import CSV, qui accepte un fichier sans colonne de
 * prix d'entrée, n'a donc pas le choix d'écrire autre chose que zéro. Interdire
 * ici ce que la base impose là-bas ferait un garde qui accuse du code juste.
 * (Aucun trade de production ne porte `entry_price = 0` à ce jour.)
 */
const PRIX = ["exit_price", "sl", "tp", "sl_initial", "tp_initial"];

describe("l'écriture d'un prix", () => {
  it("n'invente jamais un zéro", () => {
    const fautes: string[] = [];
    for (const chemin of [...sources(join(RACINE, "app")), ...sources(join(RACINE, "components")), ...sources(join(RACINE, "lib"))]) {
      const nom = chemin.slice(RACINE.length + 1).replace(/\\/g, "/");
      const src = readFileSync(chemin, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const champ of PRIX) {
        // `champ: <quelque chose> || 0` ou `?? 0`, ou le zéro écrit tout net.
        const re = new RegExp(`\\b${champ}:\\s*(?:[^,\\n]*(?:\\|\\||\\?\\?)\\s*0\\b|0\\s*,)`);
        const ligne = src.split(/\r?\n/).find((l) => re.test(l));
        if (ligne) fautes.push(`${nom} : ${ligne.trim().slice(0, 70)}`);
      }
    }
    expect(
      fautes,
      "prix écrits à zéro quand ils sont inconnus : la colonne est nullable, et " +
        "le produit passe son temps à se défendre de ces zéros à la lecture :\n  " +
        fautes.join("\n  "),
    ).toEqual([]);
  });

  /** ⚠️ Un balayage cassé rendrait le test précédent vert sans rien lire. */
  it("balaie bien des fichiers qui écrivent des trades", () => {
    const n = [...sources(join(RACINE, "components"))].filter((c) =>
      /exit_price/.test(readFileSync(c, "utf8")),
    ).length;
    expect(n, "plus aucun écran ne parle de prix de sortie : le balayage est cassé").toBeGreaterThanOrEqual(3);
  });
});
