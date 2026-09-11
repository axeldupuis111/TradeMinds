import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "./sans-commentaires";
import frDict from "./i18n/fr";

/**
 * UNE CLÉ APPELÉE PAR LE CODE EXISTE DANS LE DICTIONNAIRE.
 *
 * ── CE QUI ÉTAIT VÉRIFIÉ, ET CE QUI NE L'ÉTAIT PAS ──────────────────────────
 *
 * ⚠️⚠️ LA PARITÉ ÉTAIT TENUE ENTRE LES QUATRE LANGUES, JAMAIS ENTRE LE CODE ET
 * LA LANGUE. `translations.test.ts` vérifie que fr, en, es et de portent le
 * même jeu de clés : parfait pour attraper une traduction oubliée, aveugle au
 * cas où le code réclame une clé qu'aucun des quatre ne contient.
 *
 * ⚠️ ET CE CAS-LÀ NE CASSE RIEN : `t()` rend la clé elle-même quand elle manque.
 * Rien ne plante, rien ne s'affiche en rouge : le nom interne apparaît en toutes
 * lettres au milieu d'une phrase. C'est exactement ce que le produit faisait
 * avec `sync_cooldown`, imprimé tel quel sur la ligne d'une connexion broker.
 *
 * ⚠️ LE BALAYAGE NE VOIT QUE LES CLÉS ÉCRITES EN TOUTES LETTRES. Celles qui se
 * fabriquent (`t(\`da_kz_${kz}\`)`) échappent à toute vérification statique :
 * c'est une limite assumée, pas un oubli.
 */
describe("les clés de traduction appelées par le code existent", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  function appels(): { cle: string; ou: string }[] {
    const trouves: { cle: string; ou: string }[] = [];
    for (const racine of ["app", "components", "lib"]) {
      for (const chemin of fichiers(racine)) {
        // Les dictionnaires eux-mêmes ne sont pas des appelants.
        if (chemin.includes(join("lib", "i18n"))) continue;
        /**
         * ⚠️ LES COMMENTAIRES SONT BLANCHIS AVANT LECTURE. Une note qui dit
         * « un jour on écrira t("killzone_asia") » n'est pas un appel, et un
         * garde qui ne fait pas la différence accuse une intention.
         */
        const source = sansCommentaires(readFileSync(chemin, "utf8"));
        const nom = chemin.split(/[\\/]/).slice(-2).join("/");
        for (const m of Array.from(source.matchAll(/\bt\(\s*"([a-z][a-z0-9_]{3,})"/g))) {
          trouves.push({ cle: m[1], ou: `${nom}:${source.slice(0, m.index).split("\n").length}` });
        }
      }
    }
    return trouves;
  }

  it("balaie bien des appels, sinon ce test ne prouve rien", () => {
    expect(appels().length).toBeGreaterThan(1000);
  });

  it("aucune clé écrite en toutes lettres n'est absente du dictionnaire", () => {
    const fautes = appels()
      .filter(({ cle }) => !(cle in frDict))
      .map(({ cle, ou }) => `${ou} → "${cle}"`);
    expect(
      Array.from(new Set(fautes)),
      "clés que l'écran afficherait telles quelles : " + fautes.join(" | "),
    ).toEqual([]);
  });
});
