import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PIP_VALUES, type AssetType } from "./pips";
import {
  DEFAULT_PIP_VALUE_PER_LOT,
  PIP_VALUE_APPROXIMATIVE,
  UNITS_PER_LOT,
  getDefaultPipValuePerLot,
  pipValueEstApproximative,
} from "./position-sizing";

/**
 * LA VALEUR DU PIP EST LE NOMBRE LE PLUS CONSÉQUENT DU PRODUIT.
 *
 * C'est lui qui décide de la taille de position. Une erreur d'un facteur dix
 * n'y est pas une coquille d'affichage : c'est dix fois le risque prévu.
 *
 * ── DEUX TABLES POUR UN SEUL FAIT ───────────────────────────────────────────
 *
 * Le produit en tient deux, dans deux fichiers :
 *
 *   `lib/pips.ts`            PIP_VALUES        la taille d'un pip, en prix
 *   `lib/position-sizing.ts` UNITS_PER_LOT     la taille d'un contrat
 *                            DEFAULT_PIP_VALUE_PER_LOT   ce que vaut un pip
 *
 * Or la troisième se DÉDUIT des deux premières : `taille du pip × taille du
 * contrat`, dans la devise de cotation. Rien ne le vérifiait, et deux tables
 * qui disent le même fait finissent toujours par diverger.
 *
 * ── LE DÉFAUT, RELEVÉ LE 2026-09-16 ─────────────────────────────────────────
 *
 * ⚠️⚠️ TROIS VALEURS SUR QUATRE SONT EXACTES, LA QUATRIÈME EST UNE PHOTO.
 *
 *   forex_major  0,0001 × 100 000 = 10 USD   exact (cotation en USD)
 *   xauusd       0,10   ×     100 = 10 USD   exact
 *   xagusd       0,01   ×   5 000 = 50 USD   exact
 *   forex_jpy    0,01   × 100 000 = 1 000 JPY → en USD, DÉPEND DU TAUX
 *
 * La table annonce 9 USD pour les paires en yen, ce qui correspond à un
 * USD/JPY autour de 111. Le taux bouge ; la constante, non.
 *
 * ⚠️ ET L'ÉCRAN L'ANNONÇAIT COMME EXACTE, avec la même pastille verte « AUTO »
 * et la même phrase « calculée pour toi, rien à chercher sur MT5 » que pour
 * l'or. Le trader n'avait aucune raison de douter d'un nombre qui décide de sa
 * taille de position.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Toute valeur de pip par lot est soit EXACTE (et alors elle vaut exactement le
 * produit des deux autres tables), soit DÉCLARÉE APPROXIMATIVE (et alors
 * l'écran la rend modifiable et le dit). Il n'y a pas de troisième cas.
 */
describe("la valeur du pip par lot", () => {
  const TYPES = Object.keys(DEFAULT_PIP_VALUE_PER_LOT) as AssetType[];

  it("les trois tables couvrent les mêmes types d'actif", () => {
    expect(Object.keys(PIP_VALUES).sort()).toEqual(TYPES.slice().sort());
    expect(Object.keys(UNITS_PER_LOT).sort()).toEqual(TYPES.slice().sort());
    expect(Object.keys(PIP_VALUE_APPROXIMATIVE).sort()).toEqual(TYPES.slice().sort());
  });

  /**
   * ⚠️ LE CŒUR DU GARDE. Si quelqu'un change la taille du pip de l'or sans
   * toucher à sa valeur par lot, ce test le dit, au lieu de laisser le
   * calculateur recommander une taille fausse.
   */
  it("toute valeur non déclarée approximative vaut exactement pip × contrat", () => {
    const ecarts: string[] = [];
    for (const type of TYPES) {
      const valeur = DEFAULT_PIP_VALUE_PER_LOT[type];
      const unites = UNITS_PER_LOT[type];
      if (valeur === null || unites === null) continue;
      if (PIP_VALUE_APPROXIMATIVE[type]) continue;
      const attendu = PIP_VALUES[type] * unites;
      // Comparaison à la fraction près : ces nombres sont des produits de
      // décimaux, et 0.1 * 100 ne vaut pas exactement 10 en binaire.
      if (Math.abs(attendu - valeur) > 1e-9) {
        ecarts.push(`${type} : table ${valeur}, calcul ${PIP_VALUES[type]} × ${unites} = ${attendu}`);
      }
    }
    expect(
      ecarts,
      "valeurs de pip incohérentes entre `lib/pips.ts` et `lib/position-sizing.ts`. " +
        "Soit le produit est faux, soit la valeur dépend d'un taux et doit être " +
        "déclarée dans PIP_VALUE_APPROXIMATIVE :\n  " + ecarts.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️ ET UNE DÉCLARATION D'APPROXIMATION N'EST PAS UNE PORTE DE SORTIE : elle
   * n'est acceptable que là où la cotation n'est PAS dans la devise du compte.
   * Aujourd'hui, un seul type est dans ce cas.
   */
  it("l'approximation n'est admise que là où la cotation change de devise", () => {
    const approximatifs = TYPES.filter((t) => PIP_VALUE_APPROXIMATIVE[t]);
    expect(approximatifs).toEqual(["forex_jpy"]);
  });

  it("reconnaît la faute quand on la lui montre", () => {
    // Un or dont on aurait changé la taille du contrat sans changer la valeur.
    const attendu = PIP_VALUES.xauusd * 100;
    expect(attendu).toBe(DEFAULT_PIP_VALUE_PER_LOT.xauusd);
    const fauxAttendu = PIP_VALUES.xauusd * 10;
    expect(Math.abs(fauxAttendu - (DEFAULT_PIP_VALUE_PER_LOT.xauusd ?? 0))).toBeGreaterThan(1e-9);
  });

  it("les paires en yen sont signalées, les autres non", () => {
    expect(pipValueEstApproximative("USDJPY")).toBe(true);
    expect(pipValueEstApproximative("GBPJPY")).toBe(true);
    expect(pipValueEstApproximative("XAUUSD")).toBe(false);
    expect(pipValueEstApproximative("EURUSD")).toBe(false);
    // La valeur reste servie : c'est l'ordre de grandeur, pas un refus.
    expect(getDefaultPipValuePerLot("USDJPY")).toBeGreaterThan(0);
  });

  /**
   * ⚠️ ET L'ÉCRAN NE MENT PLUS. Une valeur approximative ne porte plus la
   * pastille « auto » ni la phrase « rien à chercher sur MT5 » : elle est
   * pré-remplie, modifiable, et dit de quoi elle dépend.
   */
  it("le calculateur rend une valeur approximative modifiable, et le dit", () => {
    const src = readFileSync(join(process.cwd(), "components/session/PositionSizer.tsx"), "utf8");
    expect(src, "l'écran ne distingue plus l'exact de l'estimé").toContain(
      "const pipApproximatif = defautPip !== null && pipValueEstApproximative(symbol.trim());",
    );
    expect(src, "une estimation reprendrait la pastille « auto »").toContain(
      "const autoPip = pipApproximatif ? null : defautPip;",
    );
    expect(src, "l'écran n'explique pas de quoi dépend l'estimation").toContain(
      't("sizer_pip_estime_note", { devise: cur })',
    );
  });
});
