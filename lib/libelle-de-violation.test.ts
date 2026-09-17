import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { libelleDeViolation } from "./libelle-de-violation";
import { CATEGORIE_DE_VIOLATION } from "./discipline-score";
import fr from "./i18n/fr";
import en from "./i18n/en";
import de from "./i18n/de";
import es from "./i18n/es";

/**
 * UNE VIOLATION S'AFFICHE AVEC UN NOM, JAMAIS AVEC UNE CLÉ.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ LE TRADER LISAIT « violation_lot_increase_after_loss » EN TITRE. Trois
 * endroits affichent ce nom ; un seul passait par la table de correspondance
 * qui sait que le type `lot_increase_after_loss` s'écrivait avec la clé
 * `violation_lot_increase`. Les deux autres (le détail de l'analyse et l'export
 * PDF) composaient la clé à la main, et `t()` rend la clé quand elle manque.
 *
 * ⚠️ MESURÉ EN BASE le 2026-09-17 : ce type apparaît dans TROIS analyses
 * enregistrées. Ces rapports sont payés en crédit, stockés, relus, exportés.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Les clés portent exactement le nom du type : plus de table, donc plus de
 * décalage possible. Et toute violation que le produit sait produire a son nom
 * dans les QUATRE langues.
 */

const RACINE = process.cwd();

/** Un `t` minimal : rend la traduction si elle existe, la clé sinon. */
const traduire = (dict: Record<string, string>) =>
  ((cle: string) => dict[cle] ?? cle) as unknown as Parameters<typeof libelleDeViolation>[1];

describe("le libellé d'une violation", () => {
  it("rend le nom traduit", () => {
    expect(libelleDeViolation("low_rr", traduire(fr))).toBe(fr["violation_low_rr"]);
    expect(libelleDeViolation("low_rr", traduire(en))).toBe(en["violation_low_rr"]);
  });

  /** ⚠️ C'EST LE CAS QUI A FAIT LE DÉFAUT, et il est mesuré en production. */
  it("rend le nom du type qui manquait, pas sa clé", () => {
    const rendu = libelleDeViolation("lot_increase_after_loss", traduire(fr));
    expect(rendu, "le trader lit de nouveau une clé technique").not.toContain("violation_");
    expect(rendu).toBe(fr["violation_lot_increase_after_loss"]);
  });

  it("n'affiche jamais une clé, même pour un type inconnu", () => {
    const rendu = libelleDeViolation("zzz_type_invente", traduire(fr));
    expect(rendu).toBe("zzz_type_invente");
    expect(rendu).not.toContain("violation_");
  });
});

describe("le vocabulaire des violations", () => {
  const DICTS: [string, Record<string, string>][] = [["fr", fr], ["en", en], ["de", de], ["es", es]];

  /**
   * ⚠️⚠️ TOUTE VIOLATION QUE LE PRODUIT SAIT PRODUIRE A SON NOM DANS LES QUATRE
   * LANGUES. `CATEGORIE_DE_VIOLATION` est la liste exhaustive : c'est elle qui
   * décide de la catégorie et du score, donc rien ne peut s'afficher sans y
   * figurer.
   */
  it("chaque type a son nom dans les quatre langues", () => {
    const fautes: string[] = [];
    for (const type of Object.keys(CATEGORIE_DE_VIOLATION)) {
      for (const [langue, dict] of DICTS) {
        if (!dict[`violation_${type}`]) fautes.push(`${langue} : violation_${type}`);
      }
    }
    expect(
      fautes,
      "types de violation sans nom : le trader lira la clé technique à la " +
        "place :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  it("connaît bien une dizaine de types, sinon ce test ne prouve rien", () => {
    expect(Object.keys(CATEGORIE_DE_VIOLATION).length).toBeGreaterThanOrEqual(12);
  });

  /**
   * ⚠️ ET PLUS AUCUN ÉCRAN NE COMPOSE LA CLÉ À LA MAIN : c'est la composition
   * libre qui laissait passer un type dont la clé s'appelait autrement.
   */
  it("aucun écran ne compose la clé lui-même", () => {
    const src = readFileSync(join(RACINE, "app/dashboard/analysis/page.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(
      src,
      "la clé est de nouveau composée à la main : un type dont le nom ne " +
        "correspond pas s'affichera en clair",
    ).not.toMatch(/t\(`violation_\$\{/);
  });
});
