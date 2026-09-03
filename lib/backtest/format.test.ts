import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { signe } from "./format";

describe("écrire un nombre signé", () => {
  /**
   * ⚠️⚠️ VU À L'ÉCRAN : « intervalle [-0.000 ; 0.082] ». La borne valait environ
   * -0,0004, et `toFixed` l'a arrondie à zéro en gardant son signe. Le trader
   * lisait un nombre qui n'existe pas, sur la ligne même où on lui demande de
   * juger si zéro est dans l'intervalle.
   */
  it("n'écrit jamais un zéro négatif", () => {
    expect(signe(-0.0004, 3)).toBe("0.000");
    expect(signe(-0.00000001, 3)).toBe("0.000");
    expect(signe(-0, 3)).toBe("0.000");
    expect(signe(0, 3)).toBe("0.000");
  });

  it("garde le signe dès que le nombre en a un à la précision demandée", () => {
    expect(signe(-0.0006, 3)).toBe("-0.001");
    expect(signe(0.0006, 3)).toBe("+0.001");
  });

  it("marque les positifs et les négatifs", () => {
    expect(signe(1.5, 2)).toBe("+1.50");
    expect(signe(-1.5, 2)).toBe("-1.50");
  });

  it("rend un tiret plutôt qu'un chiffre absent", () => {
    expect(signe(null)).toBe("—");
    expect(signe(undefined)).toBe("—");
    expect(signe(Number.NaN)).toBe("—");
    expect(signe(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("respecte la précision demandée", () => {
    expect(signe(1.23456, 1)).toBe("+1.2");
    expect(signe(1.23456, 4)).toBe("+1.2346");
  });
});

/**
 * ⚠️⚠️ CINQ COPIES DE CETTE FONCTION EXISTAIENT, une par carte, avec des
 * précisions différentes et des comportements différents sur le zéro. C'est
 * exactement le motif qui avait déjà produit deux chiffres contradictoires pour
 * le même coût d'aller-retour, sur le même écran.
 */
describe("une seule définition dans les cartes du backtest", () => {
  it("aucune carte ne redéfinit un formatage signé", () => {
    const dossier = join(process.cwd(), "components/backtest");
    const coupables: string[] = [];
    for (const nom of readdirSync(dossier)) {
      if (!nom.endsWith(".tsx")) continue;
      const source = readFileSync(join(dossier, nom), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      // Le motif exact de la copie : un ternaire sur le signe suivi de toFixed.
      if (/\?\s*"\+"\s*:\s*""[\s\S]{0,40}toFixed/.test(source)) coupables.push(nom);
    }
    expect(coupables, `formatage signé recopié dans : ${coupables.join(", ")}`).toEqual([]);
  });
});
