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
});
