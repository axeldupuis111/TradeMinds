import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";

/**
 * UN CODE RENVOYÉ PAR L'API EST LU PAR UN HUMAIN, DONC IL SE TRADUIT.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LA PAGE DES RÉGLAGES AFFICHAIT `sync_cooldown`. Mot pour mot, sur la
 * ligne de la connexion broker : la route renvoyait ce code interne, personne
 * ne l'attrapait, et le composant montrait la réponse telle quelle. La règle
 * existait pourtant à trois clics de là, dans « Mes trades », qui traduit ce
 * même délai depuis toujours.
 *
 * ⚠️ ET LE RESTE DE CETTE ROUTE RÉPONDAIT EN FRANÇAIS À TOUT LE MONDE :
 * « Commission invalide. », « Erreur serveur », « Broker non supporté. » Un
 * produit en quatre langues dont les refus sont tous dans une seule.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un `code` renvoyé par une route est SOIT une clé présente dans les quatre
 * dictionnaires, SOIT un code que le client traite nommément (le délai de
 * synchro, qui se rend avec un nombre de secondes). Rien d'autre : un code qui
 * n'est ni traduit ni attrapé finit affiché tel quel.
 */
describe("les codes d'erreur des routes sont lisibles", () => {
  function fichiers(d: string, out: string[] = []): string[] {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".next") continue;
      const chemin = join(d, f);
      if (statSync(chemin).isDirectory()) fichiers(chemin, out);
      else if (/\.tsx?$/.test(chemin) && !chemin.includes(".test.")) out.push(chemin);
    }
    return out;
  }

  /** Tous les `code: "…"` renvoyés par une route, avec leur fichier. */
  function codesRendus(): { code: string; ou: string }[] {
    const trouves: { code: string; ou: string }[] = [];
    for (const chemin of fichiers(join(process.cwd(), "app/api"))) {
      const source = readFileSync(chemin, "utf8");
      const nom = chemin.split(/[\\/]/).slice(-3).join("/");
      for (const m of Array.from(source.matchAll(/\bcode:\s*"([a-z0-9_]+)"/g))) {
        trouves.push({ code: m[1], ou: nom });
      }
    }
    return trouves;
  }

  /** Les codes qu'un composant traite par leur nom, sans passer par `t`. */
  function codesAttrapes(): Set<string> {
    const pris = new Set<string>();
    for (const racine of ["app", "components"]) {
      for (const chemin of fichiers(join(process.cwd(), racine))) {
        if (chemin.includes(`${join("app", "api")}`)) continue;
        const source = readFileSync(chemin, "utf8");
        for (const m of Array.from(source.matchAll(/\bcode\s*===\s*"([a-z0-9_]+)"/g))) {
          pris.add(m[1]);
        }
      }
    }
    return pris;
  }

  it("balaie bien des codes, sinon ce test ne prouve rien", () => {
    expect(codesRendus().length).toBeGreaterThan(8);
  });

  it("chaque code renvoyé est traduit dans les quatre langues, ou traité nommément", () => {
    const attrapes = codesAttrapes();
    const fautes: string[] = [];
    for (const { code, ou } of codesRendus()) {
      if (attrapes.has(code)) continue;
      const manquantes = ([
        ["fr", frDict],
        ["en", enDict],
        ["es", esDict],
        ["de", deDict],
      ] as const)
        .filter(([, dict]) => !(code in dict))
        .map(([langue]) => langue);
      if (manquantes.length > 0) fautes.push(`${ou} → "${code}" (absent en ${manquantes.join(", ")})`);
    }
    expect(
      Array.from(new Set(fautes)),
      "codes que l'utilisateur lirait tels quels : " + fautes.join(" | "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET LA SORTIE DE SECOURS RESTE ÉTROITE : si « traité nommément » devenait
   * la réponse habituelle, ce test ne dirait plus rien.
   */
  it("les codes traités nommément restent l'exception", () => {
    const attrapes = codesAttrapes();
    const rendus = new Set(codesRendus().map((c) => c.code));
    const exemptes = Array.from(rendus).filter((c) => attrapes.has(c));
    expect(exemptes.length, "trop de codes échappent à la traduction").toBeLessThan(4);
  });
});
