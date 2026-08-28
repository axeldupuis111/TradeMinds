import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "./fr";

/**
 * CHAQUE CLÉ APPELÉE DANS LE CODE EXISTE-T-ELLE VRAIMENT ?
 *
 * ⚠️ NÉ D'UNE CLÉ BRUTE AFFICHÉE À L'ÉCRAN, DEUX FOIS. Un utilisateur a vu
 * « bt_collisions_1 » écrit tel quel dans son rapport, au milieu de phrases
 * normales.
 *
 * Le test de parité entre langues ne pouvait pas l'attraper : il compare les
 * quatre fichiers entre eux, or la clé manquait dans les QUATRE. Quatre
 * fichiers d'accord sur une absence restent d'accord. La parité dit que les
 * traductions sont alignées, elle ne dit rien de ce que le code appelle.
 *
 * Ce test-ci part du CODE et vérifie que ce qu'il demande existe. C'est le sens
 * qui manquait.
 */

const RACINES = ["app", "components", "lib"];
const EXTENSIONS = [".ts", ".tsx"];

function fichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom === ".next") continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin));
    else if (EXTENSIONS.some((e) => nom.endsWith(e)) && !nom.includes(".test.")) out.push(chemin);
  }
  return out;
}

/**
 * Les clés écrites en toutes lettres dans un appel de traduction.
 *
 * ⚠️ On ne cherche QUE les littéraux. Une clé construite (`bt_cause_${cause}`)
 * ne se lit pas d'ici, et pretendre le contraire donnerait un test qui échoue
 * sur du code juste. Ces cas-là sont couverts par leurs propres tests.
 */
function clesLitterales(source: string): string[] {
  // ⚠️ LES COMMENTAIRES D'ABORD. Une documentation qui cite `t("killzone_asia")`
  // en exemple n'appelle rien du tout : la compter ferait échouer le test sur du
  // code parfaitement juste, et un test qui crie à tort finit par être ignoré.
  const sansCommentaires = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  return Array.from(sansCommentaires.matchAll(/\bt\(\s*"([a-z0-9_]+)"/g), (m) => m[1]);
}


describe("les clés de traduction appelées par le code", () => {
  const connues = new Set(Object.keys(fr));
  const sources = RACINES.flatMap((r) => fichiers(r));

  it("trouve bien des appels à traduire, sinon ce test ne prouve rien", () => {
    const total = sources.reduce((n, f) => n + clesLitterales(readFileSync(f, "utf8")).length, 0);
    expect(total).toBeGreaterThan(500);
  });

  it("existent toutes dans le fichier français", () => {
    const manquantes: string[] = [];
    for (const f of sources) {
      for (const cle of clesLitterales(readFileSync(f, "utf8"))) {
        if (!connues.has(cle)) manquantes.push(`${f} → ${cle}`);
      }
    }
    // Une clé absente ne plante pas : elle s'affiche telle quelle, en plein
    // milieu d'un rapport que le trader est censé croire.
    expect(manquantes).toEqual([]);
  });
});
