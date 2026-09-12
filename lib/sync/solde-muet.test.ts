import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sansCommentaires } from "../sans-commentaires";

/**
 * « LES TRADES PASSENT » N'EST PAS « TOUT VA BIEN ».
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * Le rail PULL (API Tradovate) fait deux choses à chaque passage : il importe
 * les trades, puis il écrit le solde réel du broker. La seconde peut échouer
 * seule (numéro de compte inconnu, comptes illisibles) pendant que la première
 * réussit.
 *
 * ⚠️⚠️ CE CAS NE FAISAIT QU'UN `console.warn`, ET LA LIGNE SUIVANTE ÉCRIVAIT
 * `last_error: null`. La connexion s'affichait donc « active, synchronisée il y
 * a trois minutes », sans un mot, pendant que le solde montré au trader restait
 * figé sur une vieille valeur. Or ce solde n'est pas décoratif : le gardien de
 * challenge calcule le drawdown dessus, et la règle du produit est qu'un solde
 * synchronisé s'affiche TEL QUEL.
 *
 * ⚠️ ET L'ÉCRAN NE MONTRAIT LA CAUSE QUE SUR UNE CONNEXION « error ». Une
 * connexion dont les trades passent reste « active » : son motif n'avait donc
 * aucune chance d'être lu. Les deux moitiés devaient être corrigées ensemble.
 *
 * ⚠️ On ne passe PAS le statut à « error » pour autant : les trades sont bien
 * arrivés, et couper la connexion serait pire que le défaut.
 */
describe("la synchronisation broker", () => {
  const rail = sansCommentaires(
    readFileSync(join(process.cwd(), "lib/sync/broker-sync.ts"), "utf8"),
  );
  const ecran = sansCommentaires(
    readFileSync(join(process.cwd(), "components/settings/TradovateConnect.tsx"), "utf8"),
  );

  it("retient la cause quand le solde n'a pas pu être écrit", () => {
    expect(
      rail,
      "l'échec d'écriture du solde ne laisse plus de trace : la connexion " +
        "s'affichera « active » et le solde restera figé sans un mot",
    ).toMatch(/causeDuSolde/);
  });

  it("n'efface plus la cause juste après l'avoir constatée", () => {
    expect(
      rail,
      "last_error est remis à null inconditionnellement : la cause est écrasée " +
        "à la ligne suivante",
    ).not.toMatch(/last_error:\s*null/);
  });

  it("garde la connexion active : les trades, eux, sont arrivés", () => {
    /**
     * ⚠️ Le piège inverse serait de marquer la connexion en erreur. Le trader
     * la couperait, et perdrait aussi l'import des trades, qui fonctionne.
     */
    expect(rail, "le rail ne marque plus la connexion active").toMatch(/status:\s*"active"/);
  });

  it("l'écran montre la cause quel que soit le statut", () => {
    expect(
      ecran,
      "la cause n'est affichée que sur une connexion « error » : celle dont " +
        "seul le solde échoue reste active, donc muette",
    ).not.toMatch(/status === "error" && c\.last_error/);
    expect(ecran, "la cause n'est plus affichée du tout").toMatch(/c\.last_error/);
  });
});
