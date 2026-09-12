import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UN RAPPEL DE PAGINATION QUI IGNORE SES BORNES TOURNE SANS FIN.
 *
 * ── LE MÉCANISME ────────────────────────────────────────────────────────────
 *
 * `fetchAllRows` boucle ainsi :
 *
 *     for (let from = 0; ; from += 1000) {
 *       const { data } = await build(from, from + 999);
 *       all.push(...data);
 *       if (data.length < 1000) break;
 *     }
 *
 * La seule condition d'arrêt est « la page n'est pas pleine ». Un rappel qui
 * n'applique pas `.range(from, to)` rend donc TOUJOURS les mille premières
 * lignes : la boucle ne s'arrête jamais, accumule les mêmes lignes en double,
 * et la route finit par expirer ou manquer de mémoire.
 *
 * ⚠️ Tant que l'utilisateur a moins de mille lignes, tout marche : la page est
 * incomplète dès le premier tour. Le défaut ne se déclenche que le jour où le
 * produit sert quelqu'un de très actif, c'est-à-dire au pire moment.
 *
 * ── POURQUOI CE PIÈGE EST FACILE À TENDRE ───────────────────────────────────
 *
 * ⚠️⚠️ DEUX FONCTIONS PORTENT CE NOM, AVEC DES CONTRATS INVERSES.
 * `lib/supabase-paginate.ts` attend que le RAPPEL pose `.range(from, to)` ;
 * `app/api/community/route.ts` définit ses propres enveloppes, délibérées et
 * documentées, où c'est le HELPER qui pose `.range` et où le rappel rend un
 * constructeur de requête.
 *
 * Les deux formes sont justes chez elles et fausses chez l'autre. Déplacer un
 * appel d'un fichier à l'autre, ce que rien n'empêche, suffit à écrire la
 * boucle infinie. Ce test garde la frontière.
 */
describe("les lectures paginées", () => {
  function fichiers(): string[] {
    const out: string[] = [];
    function marche(d: string) {
      for (const e of readdirSync(d)) {
        if (e === "node_modules" || e === ".next") continue;
        const p = join(d, e);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
      }
    }
    for (const r of ["app", "lib", "components"]) marche(join(process.cwd(), r));
    return out;
  }

  /** Le texte complet d'un appel, parenthèses équilibrées. */
  function appels(src: string, nom: string): { index: number; texte: string }[] {
    const out: { index: number; texte: string }[] = [];
    // ⚠️ Le paramètre de type s'intercale : « fetchAllRows<TradeRow>( ».
    const MOTIF = new RegExp("\\b" + nom + "\\s*(?:<[^>]*>)?\\s*\\(", "g");
    let m: RegExpExecArray | null;
    while ((m = MOTIF.exec(src)) !== null) {
      let j = src.indexOf("(", m.index);
      let prof = 0;
      for (; j < src.length; j++) {
        if (src[j] === "(") prof++;
        else if (src[j] === ")" && --prof === 0) break;
      }
      out.push({ index: m.index, texte: src.slice(m.index, j + 1) });
      MOTIF.lastIndex = j + 1;
    }
    return out;
  }

  const PAGINEURS = ["fetchAllRows", "fetchAllByIds"] as const;

  it("le garde trouve bien des appels à examiner", () => {
    // ⚠️ Garde-fou du garde-fou : la première version de ce balayage cherchait
    // « fetchAllRows( » et n'a trouvé AUCUN des cinquante appels, tous écrits
    // avec un paramètre de type. Zéro trouvaille se lit comme zéro défaut.
    let n = 0;
    for (const f of fichiers()) {
      const src = readFileSync(f, "utf8");
      for (const nom of PAGINEURS) n += appels(src, nom).length;
    }
    expect(n, "plus aucun appel paginé détecté : le motif ne reconnaît plus le code").toBeGreaterThan(30);
  });

  it("chaque rappel du pagineur PARTAGÉ pose ses bornes", () => {
    const fautifs: string[] = [];
    for (const f of fichiers()) {
      const src = readFileSync(f, "utf8");
      for (const nom of PAGINEURS) {
        /**
         * ⚠️ On saute les fichiers qui définissent LEUR PROPRE version de ce
         * nom : leur contrat est l'inverse, et l'exiger d'eux serait un faux
         * positif qui ferait désactiver le test. On ne juge que les appels au
         * pagineur partagé.
         */
        if (new RegExp("(?:async )?function " + nom + "\\b").test(src)) continue;
        for (const a of appels(src, nom)) {
          if (!/\.range\(/.test(a.texte)) {
            fautifs.push(
              f.replace(process.cwd(), "").replace(/\\/g, "/") +
                ":" + src.slice(0, a.index).split("\n").length + " (" + nom + ")",
            );
          }
        }
      }
    }
    expect(
      fautifs,
      "ce rappel ignore les bornes que le pagineur lui passe : il rendra " +
        "toujours la même première page, la boucle ne s'arrêtera jamais et la " +
        "route expirera dès qu'un utilisateur dépassera mille lignes. Sites : " +
        fautifs.join(", "),
    ).toEqual([]);
  });
});
