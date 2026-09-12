import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LE CLIENT INSTALLÉ CHEZ LE TRADER NE SE MET PAS À JOUR À DISTANCE.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ J'AI AJOUTÉ UN MESSAGE D'ERREUR QUE PERSONNE N'AURAIT VU. En versant un
 * échec d'écriture dans le tableau `errors` de la réponse, je croyais informer
 * le trader : la réponse part bien, et l'EA imprime son corps dans le journal
 * MetaTrader. Sauf qu'il ne l'imprime qu'à une condition, lue dans le fichier
 * du client : `if (StringFind(response, "\"skipped\":0") < 0)`. Tant que
 * `skipped` vaut zéro, l'EA écrit « OK » et jette le reste.
 *
 * Le correctif tenait en une ligne (`skipped++`), mais il n'y a aucun moyen de
 * le deviner côté serveur : c'est un contrat écrit dans un fichier `.mq5` que
 * le trader a copié chez lui il y a des mois.
 *
 * ── CE QUE CE GARDE TIENT ───────────────────────────────────────────────────
 *
 * ⚠️ IL LIT LE CLIENT, pas seulement le serveur. Les deux doivent rester
 * d'accord sur la seule chose que le client sait vérifier : un lot dont une
 * ligne n'est pas passée doit rendre `skipped > 0`.
 */
describe("le contrat avec le client de synchro", () => {
  const handler = readFileSync(join(process.cwd(), "lib/sync/push-handler.ts"), "utf8");

  /**
   * ⚠️⚠️ LES QUATRE CLIENTS, PAS SEULEMENT CELUI QUI AVAIT RAISON. Le serveur
   * renvoie soigneusement le motif de chaque ligne refusée ; un seul client
   * sur quatre le regardait.
   *
   *   - MT5 testait bien `"skipped":0` ;
   *   - MT4 imprimait le corps entier… sous l'étiquette « OK », donc le
   *     trader lisait OK et passait à la suite ;
   *   - cTrader marquait le trade ENVOYÉ et ne disait rien : la ligne refusée
   *     ne repartait jamais et rien n'apparaissait dans le journal ;
   *   - NinjaTrader ne lisait le corps que pour l'état de compte.
   *
   * Sur deux rails, un trade refusé disparaissait donc définitivement et en
   * silence. C'est la même règle que côté serveur (« un trade refusé n'est
   * jamais silencieux »), appliquée à un client sur quatre.
   */
  it("les quatre clients signalent un lot refusé", () => {
    const CLIENTS = [
      "public/TradeDiscipline_MT5.mq5",
      "public/TradeDiscipline_MT4.mq4",
      "public/TradeDiscipline_cTrader.cs",
      "public/TradeDiscipline_NinjaTrader.cs",
    ];
    const muets: string[] = [];
    for (const chemin of CLIENTS) {
      const src = readFileSync(join(process.cwd(), chemin), "utf8");
      /**
       * ⚠️ DANS LE FICHIER CLIENT, LA CHAINE EST ECHAPPEE : le source MQL/C#
       * contient `skipped\":0` et non `skipped":0`. Ma premiere version
       * cherchait la forme non echappee et accusait les QUATRE clients, dont
       * celui qui avait raison depuis le debut.
       */
      if (!/skipped\\":0/.test(src)) muets.push(chemin);
    }
    expect(
      muets,
      "clients qui ne signalent pas un trade refusé : " + muets.join(", "),
    ).toEqual([]);

    // ⚠️ Et le contrat reste bien `skipped`, pas `errors` : aucun client ne
    // sait lire le tableau, donc le serveur doit continuer de compter.
    for (const chemin of CLIENTS) {
      const src = readFileSync(join(process.cwd(), chemin), "utf8");
      expect(
        /errors\\"/.test(src),
        `${chemin} lit désormais \`errors\` : ce garde doit être revu`,
      ).toBe(false);
    }
  });

  /**
   * ⚠️ CHAQUE CHEMIN QUI ÉCARTE UNE LIGNE INCRÉMENTE `skipped`. Sans ça, le
   * message existe dans la réponse et le trader lit « OK ».
   */
  it("le serveur compte dans `skipped` tout ce qu'il n'a pas synchronisé", () => {
    // La validation (ligne refusée avant écriture).
    expect(handler, "la validation ne compte plus les refus").toMatch(
      /skipped\+\+;\s*\n\s*if \(errors\.length < 20\) errors\.push/,
    );
    // L'échec d'écriture (mise à jour refusée par la base).
    const depart = handler.indexOf("if (updateErr) {");
    expect(depart, "la branche d'échec de mise à jour a disparu").toBeGreaterThan(-1);
    let prof = 0;
    let i = handler.indexOf("{", depart);
    const ouverture = i;
    for (; i < handler.length; i++) {
      if (handler[i] === "{") prof++;
      else if (handler[i] === "}" && --prof === 0) break;
    }
    const corps = handler.slice(ouverture, i);
    expect(corps, "un échec d'écriture ne compte pas dans `skipped`").toMatch(/skipped\+\+/);
    expect(corps, "un échec d'écriture ne dit rien au trader").toMatch(/errors\.push/);
  });
});
