import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CURRENCY,
  deviseSansCompte,
  sumByCurrency,
  tradeCurrency,
} from "./account-currency";

/**
 * UN TRADE SANS COMPTE N'EST PAS UN TRADE EN EUROS.
 *
 * ── LE DÉFAUT ───────────────────────────────────────────────────────────────
 *
 * ⚠️⚠️ 42 % DES TRADES DU PRODUIT N'ONT AUCUN COMPTE, ET ILS S'AFFICHAIENT TOUS
 * EN EUROS. Mesuré en production le 2026-09-17 : 187 trades sur 447. Ils
 * arrivent ainsi légitimement, parce que le rail de synchro REFUSE de deviner
 * quand un trader a plusieurs comptes actifs sans numéro déclaré (c'est une
 * correction antérieure, et une bonne). Mais le repli d'affichage, lui,
 * supposait l'euro, y compris chez un trader dont AUCUN compte n'est en euros.
 *
 * ⚠️ ET C'EST PIRE DANS UN TOTAL VENTILÉ QUE DANS UNE LIGNE. `sumByCurrency`
 * range chaque trade dans le seau de sa devise : un trader qui n'a que des
 * comptes en dollars voyait ses trades orphelins créer un seau « EUR » à côté
 * du seau « USD », c'est-à-dire une deuxième devise qu'il ne possède pas, et
 * un écran qui annonce deux totaux là où il n'y en a qu'un.
 *
 * ⚠️ LA RÈGLE EXISTAIT DÉJÀ, appliquée à 3 des 8 appels de `tradeCurrency` :
 * le rapport hebdomadaire, le calendrier et le tableau de bord passaient un
 * repli ; les cinq autres laissaient l'euro par défaut. Aucun des cinq appels
 * de `sumByCurrency` n'en passait.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Le repli n'invente rien : si TOUS les comptes du trader partagent une devise,
 * un trade sans compte est forcément dans celle-là. S'ils en mélangent
 * plusieurs, on ne sait pas, et on retombe sur le défaut, comme avant.
 */

const RACINE = process.cwd();

describe("la devise d'un trade sans compte", () => {
  const usdSeul = new Map([["a1", "USD"], ["a2", "USD"]]);
  const melange = new Map([["a1", "USD"], ["a2", "EUR"]]);
  const vide = new Map<string, string>();

  it("suit la devise du trader quand tous ses comptes la partagent", () => {
    expect(deviseSansCompte(usdSeul)).toBe("USD");
    expect(tradeCurrency(null, usdSeul, deviseSansCompte(usdSeul))).toBe("USD");
  });

  it("n'invente rien quand les comptes mélangent les devises", () => {
    expect(deviseSansCompte(melange)).toBe(DEFAULT_CURRENCY);
  });

  it("retombe sur le défaut quand le trader n'a aucun compte", () => {
    expect(deviseSansCompte(vide)).toBe(DEFAULT_CURRENCY);
  });

  /**
   * ⚠️⚠️ LE CAS QUI SE VOYAIT À L'ÉCRAN : deux totaux pour un trader qui n'a
   * qu'une seule devise.
   */
  it("ne fabrique plus un seau « EUR » chez un trader qui n'a que des dollars", () => {
    const trades = [
      { pnl: -100, challengeId: "a1" },
      { pnl: -50, challengeId: null },
    ];
    const avant = sumByCurrency(trades, usdSeul);
    expect(avant.map(([c]) => c).sort(), "le défaut ne se reproduit plus").toEqual(["EUR", "USD"]);

    const apres = sumByCurrency(trades, usdSeul, deviseSansCompte(usdSeul));
    expect(apres).toEqual([["USD", -150]]);
  });

  it("garde la ventilation quand elle est réelle", () => {
    const trades = [
      { pnl: -100, challengeId: "a1" }, // USD
      { pnl: -50, challengeId: "a2" }, // EUR
      { pnl: -10, challengeId: null },
    ];
    const totaux = sumByCurrency(trades, melange, deviseSansCompte(melange));
    expect(totaux.map(([c]) => c).sort()).toEqual(["EUR", "USD"]);
    // L'orphelin rejoint l'euro, faute de mieux, et rien ne se perd.
    expect(totaux.reduce((s, [, v]) => s + v, 0)).toBe(-160);
  });
});

describe("les écrans qui affichent un trade sans compte", () => {
  /**
   * ⚠️ Chaque fichier est nommé, avec l'appel attendu : un garde qui compterait
   * seulement « combien d'appels passent un repli » resterait vert si on
   * déplaçait le défaut d'un écran à l'autre.
   */
  const ATTENDUS: [string, string][] = [
    ["components/trades/TradeList.tsx", "tradeCurrency(tr.challenge_id, currencyMap, deviseOrpheline)"],
    ["components/trades/QuickAnnotateModal.tsx", "tradeCurrency(current.challenge_id, currencyMap, deviseOrpheline)"],
    ["components/trades/CloseTradeModal.tsx", "deviseSansCompte(new Map(accounts.map((a) => [a.id, accountCurrency(a)])))"],
    ["app/dashboard/analytics/page.tsx", "tradeCurrency(id, currencyMap, deviseOrpheline)"],
    ["app/dashboard/trades/page.tsx", "sumByCurrency(recap.trades, currencyMap, deviseSansCompte(currencyMap))"],
    ["app/api/session-debrief/route.ts", "deviseSansCompte(devises)"],
    ["app/api/reactivation/route.ts", "deviseSansCompte(carteDesDevises)"],
    ["lib/coach-tools.ts", "deviseSansCompte(devises)"],
  ];

  it("passent toutes le repli du trader", () => {
    const fautes: string[] = [];
    for (const [fichier, appel] of ATTENDUS) {
      const src = readFileSync(join(RACINE, fichier), "utf8");
      if (!src.includes(appel)) fautes.push(`${fichier} : ${appel}`);
    }
    expect(
      fautes,
      "écrans qui supposent encore l'euro pour un trade sans compte :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });

  /**
   * ⚠️⚠️ ET AUCUN APPEL NE RESTE SANS REPLI. La liste ci-dessus dit ce qui est
   * corrigé ; celle-ci dit qu'il n'en reste pas d'autre. C'est la moitié qui
   * manquait la première fois : la règle était écrite, appliquée à trois appels
   * sur huit, et personne ne comptait les cinq autres.
   */
  it("aucun appel de sumByCurrency ne laisse le repli par défaut", () => {
    const fichiers = [
      "app/api/reactivation/route.ts",
      "app/api/session-debrief/route.ts",
      "app/api/weekly-report/route.ts",
      "app/dashboard/analytics/page.tsx",
      "app/dashboard/trades/page.tsx",
      "lib/coach-tools.ts",
    ];
    const fautes: string[] = [];
    for (const fichier of fichiers) {
      const src = readFileSync(join(RACINE, fichier), "utf8");
      let i = src.indexOf("sumByCurrency(");
      while (i !== -1) {
        // La frontière est la parenthèse fermante de l'appel, pas une distance.
        let prof = 0;
        let fin = i;
        for (let j = i + "sumByCurrency".length; j < src.length; j++) {
          if (src[j] === "(") prof++;
          else if (src[j] === ")") {
            prof--;
            if (prof === 0) { fin = j; break; }
          }
        }
        const appel = src.slice(i, fin + 1);
        // Trois arguments : les trades, la carte, le repli.
        const virgulesDeHautNiveau = (() => {
          let p = 0, n = 0;
          for (const c of appel.slice("sumByCurrency(".length, -1)) {
            if (c === "(" || c === "[" || c === "{") p++;
            else if (c === ")" || c === "]" || c === "}") p--;
            else if (c === "," && p === 0) n++;
          }
          return n;
        })();
        if (virgulesDeHautNiveau < 2) {
          fautes.push(`${fichier} : ${appel.replace(/\s+/g, " ").slice(0, 70)}`);
        }
        i = src.indexOf("sumByCurrency(", i + 1);
      }
    }
    expect(
      fautes,
      "totaux ventilés sans repli : un trader sans compte en euros y voit " +
        "apparaître un seau « EUR » :\n  " + fautes.join("\n  "),
    ).toEqual([]);
  });
});
