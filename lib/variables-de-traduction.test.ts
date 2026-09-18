import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UNE VARIABLE NE SE PERD PAS EN TRADUCTION.
 *
 * ── CE QUE LE TEST DE PARITÉ NE VOIT PAS ────────────────────────────────────
 *
 * ⚠️ LA PARITÉ VÉRIFIE QUE LA CLÉ EXISTE DANS LES QUATRE LANGUES, pas ce qu'il
 * y a dedans. Une traduction qui oublie `{amount}` fait DISPARAÎTRE le montant
 * de la phrase, sans erreur, sans clé manquante et sans test rouge : le lecteur
 * lit « Tu as perdu sur ta séance » au lieu de « Tu as perdu 240 € sur ta
 * séance ». Ce dépôt a déjà payé deux fois la variante de ce défaut (une clé
 * technique affichée telle quelle), et celle-ci est plus discrète encore.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Les VARIABLES SIMPLES (`{x}`) sont les mêmes dans les quatre langues.
 *
 * ⚠️ LES MARQUEURS D'ACCORD (`{n|singulier|pluriel}`) SONT EXEMPTÉS, et pour
 * une bonne raison : l'anglais et l'allemand n'accordent pas là où le français
 * et l'espagnol accordent. « {n|restante|restantes} aujourd'hui » n'a pas
 * d'équivalent dans « remaining today », et l'exiger accuserait une traduction
 * juste.
 */

const RACINE = process.cwd();
const LANGUES = ["fr", "en", "de", "es"] as const;

function dictionnaire(langue: string): Record<string, string> {
  const src = readFileSync(join(RACINE, `lib/i18n/${langue}.ts`), "utf8");
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/^\s*"([a-z0-9_]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)) {
    out[m[1]] = m[2];
  }
  return out;
}

/** Les `{x}` qui portent une VALEUR, marqueurs d'accord exclus. */
function variables(texte: string): Set<string> {
  const out = new Set<string>();
  for (const m of texte.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)) out.add(m[1]);
  return out;
}

describe("les variables des traductions", () => {
  const dicts = Object.fromEntries(LANGUES.map((l) => [l, dictionnaire(l)])) as Record<
    (typeof LANGUES)[number],
    Record<string, string>
  >;

  it("lit bien les quatre dictionnaires", () => {
    for (const l of LANGUES) {
      expect(Object.keys(dicts[l]).length, `dictionnaire ${l} illisible`).toBeGreaterThan(3000);
    }
  });

  it("sont les mêmes dans les quatre langues", () => {
    const fautes: string[] = [];
    for (const [cle, ref] of Object.entries(dicts.fr)) {
      const attendues = variables(ref);
      for (const l of LANGUES.slice(1)) {
        const autre = dicts[l][cle];
        if (autre === undefined) continue; // la parité est éprouvée ailleurs
        const vues = variables(autre);
        const manquantes = Array.from(attendues).filter((v) => !vues.has(v));
        const enTrop = Array.from(vues).filter((v) => !attendues.has(v));
        if (manquantes.length || enTrop.length) {
          fautes.push(
            `${cle} [${l}]` +
              (manquantes.length ? ` manque {${manquantes.join("},{")}}` : "") +
              (enTrop.length ? ` en trop {${enTrop.join("},{")}}` : ""),
          );
        }
      }
    }
    expect(
      fautes,
      "variables perdues ou inventées en traduction : le lecteur verra une " +
        "phrase à trou, ou une accolade en clair :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET UNE VARIABLE SE REMPLIT : une accolade qui survit à l'affichage est
   * un texte non rempli. On vérifie qu'aucune traduction ne contient une
   * accolade ouvrante sans fermante, faute de quoi `remplir` la laisserait
   * telle quelle.
   */
  it("n'ont pas d'accolade orpheline", () => {
    const fautes: string[] = [];
    for (const l of LANGUES) {
      for (const [cle, texte] of Object.entries(dicts[l])) {
        const ouvrantes = (texte.match(/\{/g) || []).length;
        const fermantes = (texte.match(/\}/g) || []).length;
        if (ouvrantes !== fermantes) fautes.push(`${l} : ${cle} (${ouvrantes} ouvrantes, ${fermantes} fermantes)`);
      }
    }
    expect(fautes, "accolades dépareillées : " + fautes.join(", ")).toEqual([]);
  });
});
