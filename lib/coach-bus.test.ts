import { describe, expect, it } from "vitest";
import { EVENEMENT_COACH, demanderAuCoach, ecouterDemandesCoach } from "./coach-bus";

/**
 * CE QUE CES TESTS PROTÈGENT.
 *
 * Ce module est appelé depuis des pages rendues côté serveur. Un accès à
 * `window` non gardé y jetterait au rendu, et ferait tomber la page entière
 * pour une fonctionnalité accessoire : ouvrir un chat.
 */

describe("le bus survit à l'absence de fenêtre", () => {
  it("demander au coach côté serveur ne jette pas", () => {
    // ⚠️ Vitest tourne sans DOM ici : c'est exactement la situation du rendu
    // serveur. Une page ne doit jamais dépendre de la présence du dock.
    expect(typeof window).toBe("undefined");
    expect(() => demanderAuCoach("test")).not.toThrow();
  });

  it("s'abonner côté serveur rend un désabonnement inoffensif", () => {
    const stop = ecouterDemandesCoach(() => {});
    expect(typeof stop).toBe("function");
    expect(() => stop()).not.toThrow();
  });

  it("le nom de l'événement n'a qu'une seule source", () => {
    // S'il diverge entre l'émetteur et l'écouteur, rien ne casse et rien ne
    // marche : le clic reste sans effet, en silence. D'où la constante partagée.
    expect(EVENEMENT_COACH).toBe("td:coach:demander");
  });
});
