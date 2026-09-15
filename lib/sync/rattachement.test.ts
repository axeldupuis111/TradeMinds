import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { challengeRattache } from "./rattachement";
import { sansCommentaires } from "../sans-commentaires";

const CARTE = new Map([
  ["511351527", "ch-ftmo"],
  ["DEMO8651651", "ch-tradovate"],
]);

describe("le rattachement d'un envoi de robot à un challenge", () => {
  it("suit le numéro de compte quand il correspond", () => {
    expect(challengeRattache("DEMO8651651", CARTE, "ch-actif")).toBe("ch-tradovate");
    expect(challengeRattache("511351527", CARTE, null)).toBe("ch-ftmo");
  });

  it("REFUSE de deviner quand le numéro fourni n'est déclaré nulle part", () => {
    /**
     * ⚠️⚠️ LE DÉFAUT MESURÉ EN PRODUCTION. « SONDE-COMPTE-0000 » a été accepté
     * et le solde écrit sur le challenge Tradovate actif, qui porte un tout
     * autre numéro. Le client NinjaTrader, qui cherche `"account":"ok"`, s'est
     * tu.
     */
    expect(challengeRattache("SONDE-COMPTE-0000", CARTE, "ch-actif")).toBeNull();
    expect(challengeRattache("51135152", CARTE, "ch-actif")).toBeNull(); // un chiffre en moins
  });

  it("garde le repli quand le trader n'a déclaré AUCUN numéro", () => {
    /**
     * ⚠️ Sans numéro déclaré, il n'y a rien à comparer : le numéro envoyé ne
     * peut correspondre à rien par construction. Refuser ici casserait une
     * synchro qui fonctionne aujourd'hui chez des traders qui n'ont jamais
     * rempli ce champ.
     */
    const vide = new Map<string, string>();
    expect(challengeRattache("QUELQUE-CHOSE", vide, "ch-actif")).toBe("ch-actif");
    expect(challengeRattache("", vide, "ch-actif")).toBe("ch-actif");
  });

  it("garde le repli quand le robot n'envoie aucun numéro", () => {
    // Les anciens EA MetaTrader n'envoient pas toujours le compte.
    expect(challengeRattache("", CARTE, "ch-actif")).toBe("ch-actif");
    expect(challengeRattache(null, CARTE, "ch-actif")).toBe("ch-actif");
    expect(challengeRattache(undefined, CARTE, "ch-actif")).toBe("ch-actif");
    expect(challengeRattache("   ", CARTE, "ch-actif")).toBe("ch-actif");
  });

  it("ne devine RIEN quand la carte n'a pas pu être lue", () => {
    /**
     * ⚠️⚠️ L'ANGLE MORT DE LA CORRECTION ELLE-MÊME. La règle se décide sur
     * « le trader a-t-il déclaré des numéros ? », et une lecture ratée rendait
     * une carte VIDE : la panne se présentait donc comme « aucun numéro
     * déclaré » et rouvrait exactement la devinette qu'on venait de fermer.
     *
     * Un `null` distinct dit « je ne sais pas », et on ne devine jamais sur
     * « je ne sais pas ».
     */
    expect(challengeRattache("DEMO8651651", null, "ch-actif")).toBeNull();
    expect(challengeRattache("", null, "ch-actif")).toBeNull();
    expect(challengeRattache(null, null, "ch-actif")).toBeNull();
  });

  it("ne devine JAMAIS pour un rail qui ne tourne sur aucun compte", () => {
    /**
     * ⚠️⚠️ MESURÉ LE 2026-09-15 en testant le webhook TradingView de bout en
     * bout : un trade venu d'une alerte Pine se rattachait au challenge
     * Tradovate actif du compte.
     *
     * Le repli suppose un compte qui EXISTE et qui s'est tu : un expert advisor
     * est installé SUR un compte MetaTrader. Une stratégie Pine, elle, tourne
     * sur un GRAPHIQUE, avec des exécutions simulées, et le snippet distribué
     * n'a aucun numéro à envoyer parce qu'il n'y a aucun compte.
     *
     * Ces trades entraient donc dans le P&L du challenge, dans sa courbe
     * d'équité et dans le drawdown sur lequel le gardien décide de prévenir :
     * la fonctionnalité qui promet d'avertir « avant que tu fasses sauter ton
     * compte » se prononçait sur des trades jamais passés dessus.
     */
    expect(challengeRattache("", CARTE, "ch-actif", "tradingview")).toBeNull();
    expect(challengeRattache(null, new Map(), "ch-actif", "tradingview")).toBeNull();
  });

  it("mais suit quand même un compte explicitement nommé", () => {
    // ⚠️ Le trader qui VEUT rattacher son alerte le dit : le parseur accepte
    // « account » dans le message. On ne lui refuse pas ce qu'il a désigné.
    expect(challengeRattache("DEMO8651651", CARTE, null, "tradingview")).toBe("ch-tradovate");
  });

  it("garde le repli pour les rails installés sur un compte", () => {
    for (const rail of ["mt4", "mt5", "ctrader", "ninjatrader", undefined]) {
      expect(
        challengeRattache("", CARTE, "ch-actif", rail),
        `${rail} est installé sur un compte : le repli doit rester`,
      ).toBe("ch-actif");
    }
  });

  it("ne rattache à rien quand il n'y a ni correspondance ni repli", () => {
    expect(challengeRattache("", new Map(), null)).toBeNull();
    expect(challengeRattache("INCONNU", CARTE, null)).toBeNull();
  });
});

describe("les deux rails passent par cette décision", () => {
  /**
   * ⚠️ Le rail PUSH (EA, cBot, add-on) et le rail PULL (API Tradovate)
   * rattachaient chacun de leur côté, avec la même expression `?? repli`. Une
   * règle écrite deux fois finit toujours par n'être corrigée qu'une fois.
   */
  for (const fichier of ["lib/sync/account-snapshot.ts", "lib/sync/push-handler.ts"]) {
    it(`${fichier} ne devine plus tout seul`, () => {
      const src = sansCommentaires(readFileSync(join(process.cwd(), fichier), "utf8"));
      expect(
        src,
        "ce fichier décide du rattachement lui-même : le refus d'un numéro inconnu " +
          "peut y disparaître sans que rien ne le dise",
      ).toContain("challengeRattache(");
      expect(
        src,
        "l'ancien repli « ?? challenge actif » est revenu : un solde ou un trade " +
          "venu d'un compte inconnu atterrira sur le challenge en cours",
      ).not.toMatch(/\?\?\s*\(?\s*await\s+resolveActiveChallengeId/);
    });
  }

  it("le rail transmis est celui de la ligne, pas une valeur écrite en dur", () => {
    /**
     * ⚠️⚠️ SANS CE GARDE, LA RÈGLE SE DÉTACHE EN SILENCE. Vérifié par mutation :
     * remplacer `String(fields.source)` par `"mt5"` laissait tous les autres
     * tests verts, et les trades TradingView se rattachaient de nouveau au
     * challenge en cours. La décision peut être juste et son câblage faux.
     */
    const src = sansCommentaires(
      readFileSync(join(process.cwd(), "lib/sync/push-handler.ts"), "utf8"),
    );
    const appels = src.match(/resolveChallenge\([^)]*\)/g) ?? [];
    expect(appels.length, "plus aucun appel : le découpage a changé").toBeGreaterThanOrEqual(2);

    const enDur = appels.filter((a) => /,\s*["'`]/.test(a));
    expect(
      enDur,
      "le rail est écrit en dur au lieu d'être lu sur la ligne : un trade " +
        "TradingView repassera pour un trade de courtier. Appels : " + enDur.join(", "),
    ).toEqual([]);
  });
});
