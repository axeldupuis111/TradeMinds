import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UN NOMBRE ANIMÉ ARRIVE À DESTINATION, MÊME SANS ANIMATION.
 *
 * ── LE DÉFAUT, VU À L'ÉCRAN ─────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR LE BILAN MENSUEL : « Trades 0 », « Jours tradés 0 », « Taux de
 * réussite 0 % », « P&L net du mois +0 € » — pendant que la courbe d'équité
 * juste en dessous affichait +8 032 €, que « Paire favorite » annonçait 30
 * trades, et que l'état de la page portait bien 32 trades. Toutes les valeurs
 * ANIMÉES étaient restées à zéro ; toutes les autres étaient justes.
 *
 * ⚠️ LA CAUSE N'EST PAS DANS LE CALCUL : l'animation ne démarre qu'à la
 * première intersection et avance par `requestAnimationFrame`. Un onglet qui
 * n'est pas visible ne reçoit NI l'un NI l'autre. Le compteur reste alors à sa
 * valeur initiale — zéro — et un zéro affiché à la place d'un chiffre réel est
 * le pire défaut possible sur un bilan mensuel.
 *
 * ⚠️ CE N'EST PAS QU'UN CAS DE LABORATOIRE : un onglet ouvert en arrière-plan,
 * une impression, une capture d'écran, un appareil qui saute des images
 * produisent la même page.
 *
 * LA RÈGLE : l'animation est un agrément, la valeur est un dû.
 */
describe("CountUp arrive toujours à sa valeur", () => {
  const source = readFileSync(
    join(process.cwd(), "components/animations/CountUp.tsx"),
    "utf8",
  );

  it("pose la valeur finale par un délai, indépendamment des images peintes", () => {
    expect(source).toContain("setTimeout(() => setCount(end), duration * 1000 + 100)");
  });

  /**
   * ⚠️ ET CE FILET NE DÉPEND NI DE L'INTERSECTION NI DU MOUVEMENT RÉDUIT :
   * s'il vivait dans le même effet que l'animation, il hériterait de son
   * `if (!isInView) return;` et ne servirait à rien.
   */
  it("le filet vit dans son propre effet", () => {
    const i = source.indexOf("setTimeout(() => setCount(end)");
    expect(i).toBeGreaterThan(0);
    const effet = source.slice(source.lastIndexOf("useEffect(", i), i);
    expect(effet, "le filet est enfermé dans l'effet de l'animation").not.toContain("isInView");
  });

  /** ⚠️ Et la forme du nombre suit la langue, comme partout ailleurs. */
  it("ne fige pas la langue du nombre", () => {
    expect(source).not.toContain('toLocaleString("fr-FR")');
    expect(source).toContain("document.documentElement.lang");
  });
});
