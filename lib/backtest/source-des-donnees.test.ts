import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LE TRADER SAIT D'OÙ VIENNENT LES BOUGIES QU'ON LUI REJOUE.
 *
 * ── CE QUI MANQUAIT ─────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ L'ONGLET BACKTEST NE CITAIT SA SOURCE NULLE PART. Les fichiers portent
 * pourtant `"source": "dukascopy"` dans leur manifeste : le produit le sait, il
 * ne le disait pas. Or l'origine d'une série de prix n'est pas un détail
 * technique : deux fournisseurs ne cotent pas les mêmes extrêmes ni les mêmes
 * heures de clôture, et un résultat de rejeu ne veut rien dire sans elle.
 *
 * ⚠️ ET C'EST AUSSI LA MOINDRE DES CHOSES VIS-À-VIS DU FOURNISSEUR. Citer la
 * source ne règle PAS la question des droits de REDISTRIBUTION, qui reste
 * ouverte (les fichiers sont servis depuis un bucket public) : c'est une
 * décision qui appartient à Axel, pas une ligne de code. Ce test tient la
 * partie qui, elle, ne se discute pas.
 */
describe("la source des données de backtest", () => {
  it("est nommée à l'écran, dans les quatre langues", () => {
    for (const langue of ["fr", "en", "es", "de"]) {
      const dico = readFileSync(join(process.cwd(), "lib", "i18n", `${langue}.ts`), "utf8");
      const phrase = /"bt_donnees_source":\s*"([^"]*)"/.exec(dico)?.[1];
      expect(phrase, `${langue} : clé bt_donnees_source introuvable`).toBeTruthy();
      expect(phrase, `${langue} : « ${phrase} »`).toMatch(/Dukascopy/i);
    }
  });

  /** ⚠️ Et la phrase est bien rendue, pas seulement écrite dans le dictionnaire. */
  it("la phrase est affichée par l'onglet", () => {
    const page = readFileSync(join(process.cwd(), "app/dashboard/backtest/page.tsx"), "utf8");
    expect(page).toContain('tr("bt_donnees_source"');
  });
});
