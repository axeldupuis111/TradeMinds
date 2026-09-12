import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultLocale } from "@/i18n/config";
import { codeDeLangue, nomDeLangue } from "./langue-du-modele";
import { sansCommentaires } from "./sans-commentaires";

/**
 * LA LANGUE DU MODÈLE QUAND ON NE LA CONNAÎT PAS : UNE SEULE RÉPONSE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * Neuf routes IA résolvent la langue de leur réponse, chacune avec sa propre
 * copie de la table des langues. Quatre repliaient sur l'anglais, cinq sur le
 * français, plus le catalogue d'outils du coach et deux tables de libellés.
 * La même question, tranchée deux fois dans deux sens, dans le même dépôt.
 *
 * Le reste du produit avait déjà répondu : `defaultLocale = 'en'`,
 * `DEFAULT_LANG = 'en'`, les trois crons d'e-mails et l'e-mail de félicitations
 * replient sur l'anglais. Le français était la réponse d'un produit CONÇU en
 * français, pas celle du produit tel qu'il est lu : au 2026-09-12, 17 des 21
 * inscrits du mois sont anglophones.
 *
 * ⚠️ Et les cinq routes « français » acceptaient N'IMPORTE QUELLE chaîne comme
 * code de langue, ne repliant que sur l'échec de la recherche du NOM.
 */
describe("la langue du modèle", () => {
  it("suit la langue demandée quand elle est connue", () => {
    for (const code of ["fr", "en", "de", "es"]) {
      expect(codeDeLangue(code)).toBe(code);
    }
    expect(codeDeLangue("FR")).toBe("fr");
    expect(codeDeLangue("  de  ")).toBe("de");
  });

  it("retombe sur la langue du produit, pas sur celle du développeur", () => {
    for (const absurde of ["", "it", "zz", null, undefined, 42, {}, "français"]) {
      expect(codeDeLangue(absurde), `« ${String(absurde)} » n'est pas une langue`).toBe(defaultLocale);
    }
  });

  it("nomme toujours une langue, jamais « undefined »", () => {
    // ⚠️ Le nom part DANS LE PROMPT : « Réponds UNIQUEMENT en undefined » est
    // une consigne que le modèle interprétera comme il peut.
    for (const x of ["zz", null, undefined, "en"]) {
      expect(nomDeLangue(x)).toBeTruthy();
      expect(String(nomDeLangue(x))).not.toContain("undefined");
    }
  });
});

describe("les routes IA", () => {
  /** Toutes les routes qui dictent une langue au modèle. */
  function routesIA(): string[] {
    const trouvees: string[] = [];
    function marche(dossier: string) {
      for (const e of readdirSync(dossier)) {
        if (e === "node_modules" || e === ".next") continue;
        const p = join(dossier, e);
        if (statSync(p).isDirectory()) marche(p);
        else if (/route\.ts$/.test(p)) {
          const src = readFileSync(p, "utf8");
          if (/LANG_NAMES|LANGUES\b|langName|nomDeLangue|codeDeLangue/.test(src)) trouvees.push(p);
        }
      }
    }
    marche(join(process.cwd(), "app/api"));
    return trouvees;
  }

  it("le garde trouve bien les routes concernées", () => {
    // ⚠️ Garde-fou du garde-fou : zéro route trouvée rendrait tout vert.
    expect(routesIA().length, "plus aucune route IA détectée").toBeGreaterThanOrEqual(8);
  });

  it("aucune ne replie sur le français de son côté", () => {
    const fautives: string[] = [];
    for (const p of routesIA()) {
      const src = sansCommentaires(readFileSync(p, "utf8"));
      /**
       * Les trois formes rencontrées : le défaut de déstructuration
       * (`language = "fr"`), le repli sur le nom (`?? "français"`) et le repli
       * sur la table (`?? LANGUES.fr`).
       *
       * ⚠️⚠️ LE DERNIER MOTIF ACCEPTE LES INDICES. Sa première version cherchait
       * `TABLE.fr` et ratait `TABLE[tone].fr` : la mutation qui remettait le
       * repli français sur le bouton du coach laissait ce test vert. Un garde
       * qui ne connaît qu'une syntaxe protège la moitié de ce qu'il vise, et
       * c'est la troisième fois de la journée.
       */
      if (
        /language\s*=\s*["']fr["']/.test(src) ||
        /\?\?\s*["'](?:fr|français)["']/.test(src) ||
        /\?\?\s*[A-Za-z_$][\w$]*(?:\[[^\]]*\])*\.fr\b/.test(src)
      ) {
        fautives.push(p.replace(process.cwd(), "").replace(/\\/g, "/"));
      }
    }
    expect(
      fautives,
      "une route IA répond en français quand elle ne connaît pas la langue, " +
        "alors que tout le reste du produit répond en " + defaultLocale + " : " + fautives.join(", "),
    ).toEqual([]);
  });

  it("le coach non plus", () => {
    const src = sansCommentaires(readFileSync(join(process.cwd(), "lib/coach-tools.ts"), "utf8"));
    expect(
      src,
      "un libellé du coach retombe sur le français pour une langue inconnue",
    ).not.toMatch(/\?\?\s*[A-Za-z_$][\w$]*(?:\[[^\]]*\])*\.fr\b/);
    expect(
      src,
      "le catalogue d'outils replie encore sur le français",
    ).not.toMatch(/language\s*(?::\s*string\s*)?=\s*["']fr["']/);
  });
});
