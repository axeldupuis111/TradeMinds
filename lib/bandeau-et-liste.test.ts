import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LE TOTAL AU-DESSUS D'UNE LISTE DIT LA MÊME CHOSE QUE LA LISTE.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN EN LE FAISANT ───────────────────────────────────
 *
 * ⚠️⚠️ SUPPRIMER UN TRADE RETIRAIT LA LIGNE ET LAISSAIT LE TOTAL INCHANGÉ.
 * Mesuré sur le compte réel : la base repasse de 86 à 85, la ligne disparaît,
 * et le bandeau continue d'annoncer « 86 trades · WR 46,5 % · P&L -6 609,77 € ».
 * Deux chiffres pour le même fait, sur le même écran, à trente pixels d'écart.
 *
 * ⚠️ LA CAUSE EST UNE FRONTIÈRE DE COMPOSANT. Le bandeau appartient à la PAGE
 * (`recap`, rechargé par `loadRecap`), la liste appartient à `TradeList`
 * (`globalStats`, rechargé par `loadGlobalStats`). Les suppressions
 * rafraîchissaient le second et jamais le premier.
 *
 * ⚠️⚠️ ET CRÉER UN TRADE MARCHAIT DÉJÀ : la modale de création est montée par
 * la page, dont le `onSaved` appelle `loadRecap()`. La règle était donc écrite,
 * et appliquée à une moitié de la paire créer/supprimer. C'est la forme que
 * prend presque tout ce qui reste dans ce dépôt.
 */
describe("le bandeau des trades suit la liste", () => {
  const liste = readFileSync(join(process.cwd(), "components/trades/TradeList.tsx"), "utf8");
  const page = readFileSync(join(process.cwd(), "app/dashboard/trades/page.tsx"), "utf8");

  /**
   * ⚠️ ON ANCRE LE FAIT QUI REND LE TEST NÉCESSAIRE : le total affiché vient
   * bien d'un état de la PAGE, pas de la liste. Le jour où les deux fusionnent,
   * ce test doit être relu, pas contourné.
   */
  it("le total affiché appartient à la page, pas à la liste", () => {
    expect(page, "le bandeau ne lit plus recap").toMatch(/recap\.count/);
    expect(page, "la page ne sait plus recharger son total").toMatch(/loadRecap/);
    expect(liste, "la liste ne sait plus prévenir la page").toMatch(/onTradeUpdated/);
  });

  /**
   * ⚠️ CHAQUE GESTE QUI CHANGE LE NOMBRE DE TRADES PRÉVIENT LA PAGE. Le motif
   * cherche les fonctions qui rechargent les stats de la liste : ce sont
   * exactement celles qui ont modifié l'ensemble.
   */
  it("chaque geste qui recharge les stats de la liste prévient aussi la page", () => {
    const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));
    const lignes = liste.split(SAUT);
    const fautes: string[] = [];

    for (let i = 0; i < lignes.length; i++) {
      if (!/^\s*loadGlobalStats\(\);\s*$/.test(lignes[i])) continue;
      /**
       * ⚠️ LA FENÊTRE N'EST PAS LA FRONTIÈRE : on lit jusqu'à l'accolade qui
       * ferme la fonction, pas jusqu'à un nombre de lignes fixe. Un garde qui
       * coupe trop tôt accuse à faux, et on apprend à l'ignorer.
       */
      let bloc = "";
      for (let j = i; j < lignes.length; j++) {
        bloc += lignes[j] + "\n";
        if (/^\s{2}\}\s*$/.test(lignes[j])) break;
      }
      if (/onTradeUpdated\?\.\(\)/.test(bloc)) continue;
      /**
       * ⚠️ UNE DISPENSE S'ÉCRIT. Le seul rechargement qui ne change aucun trade
       * est celui de la pagination, du tri et des filtres : prévenir la page à
       * chaque clic de page lui ferait recharger un total qui n'a pas bougé.
       */
      const amont = lignes.slice(Math.max(0, i - 8), i).join(" ");
      if (amont.includes("LECTURE SEULE")) continue;
      fautes.push(`ligne ${i + 1}`);
    }

    expect(
      fautes,
      "gestes qui rechargent la liste sans rafraîchir le total au-dessus : " + fautes.join(", "),
    ).toEqual([]);
  });

  it("balaie bien des gestes, sinon ce test ne prouve rien", () => {
    const n = (liste.match(/loadGlobalStats\(\);/g) ?? []).length;
    expect(n, "plus aucun rechargement de stats : le motif ne correspond plus").toBeGreaterThan(2);
  });
});
