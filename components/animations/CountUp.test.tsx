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

/**
 * ET LE RENDU DU SERVEUR PORTE LA VALEUR, PAS ZÉRO.
 *
 * ⚠️⚠️ LE FILET CI-DESSUS NE POUVAIT RIEN AVANT L HYDRATATION : c est un effet
 * React, il ne s exécute que côté client. Le HTML envoyé par le serveur
 * portait donc l état initial du compteur — zéro.
 *
 * ⚠️ MESURÉ SUR LA PRODUCTION LE 2026-09-18, dans la session réelle : la carte
 * « SCORE DE DISCIPLINE » du tableau de bord a affiché « 0/100 » pendant
 * 3,6 SECONDES, avec à côté le verdict « Discipline correcte, à améliorer »,
 * calculé lui à partir du VRAI score de 74. Deux moitiés de la même carte qui
 * se contredisaient, sur la carte principale du produit.
 *
 * ⚠️ DIX-SEPT CHIFFRES ÉTAIENT DANS CE CAS sur cinq écrans : le score, le P&L
 * du mois, les séries, les taux de réussite, le capital récupérable.
 */
describe("CountUp ne montre jamais zéro à la place de sa valeur", () => {
  const source = readFileSync(
    join(process.cwd(), "components/animations/CountUp.tsx"),
    "utf8",
  );

  it("rend la valeur tant que le client n a pas pris la main", () => {
    expect(source, "le rendu ne distingue plus le serveur du client").toContain(
      "clientPret ? count : end",
    );
  });

  /**
   * ⚠️ LE DRAPEAU SE LÈVE DANS SON PROPRE EFFET, SANS DÉPENDANCE : s il
   * dépendait de l intersection ou de `end`, il hériterait des conditions qui
   * empêchent déjà l animation de démarrer, et le zéro reviendrait.
   */
  it("le drapeau ne dépend de rien d autre que du montage", () => {
    expect(source).toContain("useEffect(() => setClientPret(true), []);");
  });

  /** ⚠️ Et le nombre formaté vient bien de cette valeur-là, pas du compteur. */
  it("formate la valeur affichée, pas l état interne", () => {
    const i = source.indexOf("const formatted");
    expect(i).toBeGreaterThan(0);
    const corps = source.slice(i, source.indexOf("return (", i));
    expect(corps, "le formatage lit encore le compteur brut").not.toContain("count.toLocaleString");
    expect(corps).toContain("affiche");
  });
});
