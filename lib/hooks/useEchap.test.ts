import { describe, expect, it, vi } from "vitest";
import { brancherEchap, type CibleClavier } from "./useEchap";

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
