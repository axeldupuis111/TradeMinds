import { describe, expect, it, vi } from "vitest";
import { brancherEchap, donnerLeFocus, type CibleClavier } from "./useFenetreModale";

/**
 * LE RACCOURCI FAIT QUELQUE CHOSE, PAS SEULEMENT « IL EST APPELÉ ».
 *
 * ⚠️ `modales.test.ts` vérifie que chaque fenêtre APPELLE le hook. Sans ce
 * test-ci, les vingt-huit fenêtres pourraient toutes appeler une fonction vide
 * et les deux tests resteraient verts. C'est la différence entre « la ligne est
 * là » et « la touche ferme ».
 */
describe("brancherEchap", () => {
  /** Un double du document : ce dépôt n'a pas de DOM en test. */
  function cible() {
    const poses: { h: (e: KeyboardEvent) => void; capture: boolean }[] = [];
    const c: CibleClavier = {
      addEventListener: (_t, h, capture) => poses.push({ h, capture }),
      removeEventListener: (_t, h) => {
        const i = poses.findIndex((p) => p.h === h);
        if (i >= 0) poses.splice(i, 1);
      },
    };
    return {
      c,
      poses,
      frapper: (key: string) => poses.forEach((p) => p.h({ key } as KeyboardEvent)),
    };
  }

  it("ferme sur Échap", () => {
    const { c, frapper } = cible();
    const fermer = vi.fn();
    brancherEchap(c, fermer);
    frapper("Escape");
    expect(fermer).toHaveBeenCalledTimes(1);
  });

  it("ignore les autres touches", () => {
    const { c, frapper } = cible();
    const fermer = vi.fn();
    brancherEchap(c, fermer);
    frapper("Enter");
    frapper("a");
    expect(fermer).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ EN CAPTURE, et le test le vérifie : sans ça, un champ de saisie qui
   * arrête la propagation avalerait la touche, et une fenêtre de SAISIE est
   * exactement celle où Échap doit marcher.
   */
  it("écoute en phase de capture", () => {
    const { c, poses } = cible();
    brancherEchap(c, () => {});
    expect(poses).toHaveLength(1);
    expect(poses[0].capture).toBe(true);
  });

  /** ⚠️ Et il se débranche : sinon l'écouteur s'accumule à chaque ouverture. */
  it("rend de quoi se débrancher", () => {
    const { c, poses, frapper } = cible();
    const fermer = vi.fn();
    const debrancher = brancherEchap(c, fermer);
    debrancher();
    expect(poses).toHaveLength(0);
    frapper("Escape");
    expect(fermer).not.toHaveBeenCalled();
  });
});

/**
 * LE FOCUS ENTRE DANS LA FENÊTRE, PUIS REVIENT.
 *
 * ⚠️⚠️ C'EST DEVENU OBLIGATOIRE LE JOUR OÙ LES FENÊTRES ONT REÇU
 * `aria-modal="true"` : cet attribut dit à une lecture d'écran d'IGNORER tout
 * le reste de la page. Si le focus reste derrière, le lecteur est dans le vide,
 * sans rien à lire ni rien qui explique pourquoi. Déclarer une fenêtre modale
 * sans déplacer le focus rend le produit MOINS utilisable qu'avant.
 */
describe("donnerLeFocus", () => {
  /** Un document de fortune : ce dépôt n'a pas de DOM en test. */
  /** Le strict minimum dont `donnerLeFocus` se sert sur un élément. */
  type FauxElement = {
    id: string;
    attributs: Map<string, string>;
    focusRecu: number;
    hasAttribute(n: string): boolean;
    setAttribute(n: string, v: string): void;
    focus(): void;
  };

  function faux(fenetres: { id: string; tabindex?: string }[], actifAvant: string) {
    const elements = new Map<string, FauxElement>();
    const creer = (id: string, tabindex?: string) => {
      const el: FauxElement = {
        id,
        attributs: new Map<string, string>(tabindex ? [["tabindex", tabindex]] : []),
        focusRecu: 0,
        hasAttribute: (n: string) => el.attributs.has(n),
        setAttribute: (n: string, v: string) => el.attributs.set(n, v),
        focus: () => {
          el.focusRecu++;
          faussaire.activeElement = el;
        },
      };
      elements.set(id, el);
      return el;
    };
    const avant = creer(actifAvant);
    const liste = fenetres.map((f) => creer(f.id, f.tabindex));
    const faussaire = {
      activeElement: avant as FauxElement | null,
      querySelectorAll: () => liste,
      contains: (el: FauxElement) => elements.has(el.id),
    };
    // ⚠️ On remplace le document le temps du test : ce dépôt tourne sans DOM.
    (globalThis as unknown as { document: unknown }).document = faussaire;
    return { avant, liste };
  }

  it("donne le focus à la DERNIÈRE fenêtre ouverte", () => {
    const { liste } = faux([{ id: "a" }, { id: "b" }], "bouton");
    donnerLeFocus();
    expect(liste[0].focusRecu).toBe(0);
    expect(liste[1].focusRecu).toBe(1);
  });

  /** ⚠️ -1 : atteignable par programme, jamais par tabulation. */
  it("rend la fenêtre focusable sans l'ajouter à la tabulation", () => {
    const { liste } = faux([{ id: "a" }], "bouton");
    donnerLeFocus();
    expect(liste[0].attributs.get("tabindex")).toBe("-1");
  });

  it("ne touche pas à un tabindex déjà posé", () => {
    const { liste } = faux([{ id: "a", tabindex: "0" }], "bouton");
    donnerLeFocus();
    expect(liste[0].attributs.get("tabindex")).toBe("0");
  });

  /** ⚠️ La moitié qui s'oublie : refermer doit rendre le focus au bouton. */
  it("rend le focus à l'élément d'où l'on venait", () => {
    const { avant } = faux([{ id: "a" }], "bouton");
    const rendre = donnerLeFocus();
    rendre();
    expect(avant.focusRecu).toBe(1);
  });

  it("ne plante pas si aucune fenêtre n'est ouverte", () => {
    faux([], "bouton");
    expect(() => donnerLeFocus()()).not.toThrow();
  });
});
