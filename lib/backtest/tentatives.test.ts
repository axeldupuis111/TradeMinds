import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compterUnEssai, lireTentatives } from "./tentatives";

function fauxStockage() {
  const donnees = new Map<string, string>();
  return {
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => void donnees.set(k, v),
    removeItem: (k: string) => void donnees.delete(k),
    clear: () => donnees.clear(),
    donnees,
  };
}

let stockage: ReturnType<typeof fauxStockage>;

beforeEach(() => {
  stockage = fauxStockage();
  vi.stubGlobal("window", { localStorage: stockage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("le compteur d'essais", () => {
  it("part de zéro sur une stratégie jamais testée", () => {
    expect(lireTentatives("s1").n).toBe(0);
  });

  /**
   * ⚠️ LA RAISON D'ÊTRE DU FICHIER. Le compteur vivait dans un `useState` : un
   * rechargement d'onglet le remettait à zéro, et l'alerte de sur-apprentissage
   * ne se déclenchait jamais pour quelqu'un qui travaille sur plusieurs
   * sessions. Un garde-fou qu'un F5 désarme n'en est pas un.
   */
  it("survit à un rechargement", () => {
    compterUnEssai("s1");
    compterUnEssai("s1");
    compterUnEssai("s1");
    // Un rechargement, c'est exactement ça : on relit sans rien garder en mémoire.
    expect(lireTentatives("s1").n).toBe(3);
  });

  it("garde la date du premier essai", () => {
    const premier = compterUnEssai("s1");
    const troisieme = (compterUnEssai("s1"), compterUnEssai("s1"));
    expect(troisieme.depuis).toBe(premier.depuis);
  });

  /**
   * ⚠️ Deux méthodes sont deux recherches. Les additionner ferait crier au
   * sur-apprentissage quelqu'un qui a simplement deux fiches.
   */
  it("compte séparément chaque stratégie", () => {
    compterUnEssai("s1");
    compterUnEssai("s1");
    compterUnEssai("s2");
    expect(lireTentatives("s1").n).toBe(2);
    expect(lireTentatives("s2").n).toBe(1);
  });

  it("ne compte rien sans stratégie choisie, et ne plante pas", () => {
    expect(() => compterUnEssai("")).not.toThrow();
    expect(compterUnEssai("").n).toBe(1);
    expect(stockage.donnees.size).toBe(0);
  });
});

/**
 * ⚠️ `localStorage` ÉCHOUE POUR DE VRAI : navigation privée, stockage refusé,
 * quota plein. Une exception ici viderait la page de backtest entière, pour un
 * compteur d'inconfort. On dégrade, on ne casse pas.
 */
describe("quand le navigateur refuse de stocker", () => {
  it("lit zéro au lieu de lever", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("refusé");
        },
        setItem: () => {
          throw new Error("refusé");
        },
      },
    });
    expect(() => lireTentatives("s1")).not.toThrow();
    expect(lireTentatives("s1").n).toBe(0);
  });

  it("compte quand même l'essai en cours", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      },
    });
    expect(compterUnEssai("s1").n).toBe(1);
  });

  /**
   * ⚠️ Ce qu'on relit est du texte modifiable à la main. « Essai n° NaN » à
   * l'écran serait pire qu'un compteur remis à zéro.
   */
  it("ignore un contenu abîmé plutôt que d'afficher n'importe quoi", () => {
    for (const abime of ["pas du json", '{"n":"beaucoup"}', '{"n":-5}', "null", '{"n":null}']) {
      stockage.donnees.set("backtest:tentatives:s1", abime);
      const lu = lireTentatives("s1");
      expect(Number.isFinite(lu.n)).toBe(true);
      expect(lu.n).toBeGreaterThanOrEqual(0);
      expect(typeof lu.depuis).toBe("string");
    }
  });
});
