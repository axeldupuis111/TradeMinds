import type { HeatmapBounds, HeatmapCell } from "@/lib/analytics/heatmap";

/**
 * JUSQU'OÙ UNE CELLULE PEUT SE SATURER SANS RENDRE SON CHIFFRE ILLISIBLE.
 *
 * ── LE DÉFAUT, MESURÉ ───────────────────────────────────────────────────────
 *
 * ⚠️⚠️ SUR ANALYTICS, EN THÈME CLAIR : « -3.0k » écrit dans la cellule la plus
 * rouge donnait **3,68:1**, sous le seuil AA, en corps 9. Le commentaire du
 * composant annonçait « lisible sur fonds saturés comme sur fonds pâles » :
 * c'était vrai des fonds pâles, et faux du cas extrême, celui qui porte
 * justement le plus gros chiffre de la grille.
 *
 * ⚠️⚠️ ET LE THÈME SOMBRE ÉTAIT PIRE : encre claire sur la cellule la plus
 * verte, **2,22:1**. Personne ne l'avait mesuré dans l'un ni dans l'autre.
 *
 * ── POURQUOI PLAFONNER LE FOND, ET PAS CHANGER D'ENCRE ──────────────────────
 *
 * Basculer d'une encre sombre à une encre claire selon la saturation semble
 * évident, et c'est un piège : la mesure dit que ça ne marche pas. Les cellules
 * sont des TEINTES sur le fond de la carte, donc à mi-saturation elles restent
 * pâles en thème clair (rouge à 0,60 sur blanc : l'encre claire n'y tient que
 * 2,72:1). Une bascule à mi-chemin est donc pire que l'encre unique.
 *
 * ⚠️ CE QUI FAIT LE DÉFAUT, C'EST LA SATURATION, pas l'encre : les deux thèmes
 * échouent au même endroit, tout en haut de l'échelle. On plafonne donc le
 * fond. Le dégradé est un peu plus doux au sommet ; l'ORDRE des cellules, lui,
 * ne change pas, et c'est lui qui porte l'information.
 *
 * ⚠️ LA VALEUR VIENT DE LA MESURE, PAS DU GOÛT : le cas contraignant est le
 * vert du thème sombre, qui décroche à 0,62. On garde 0,60, soit 4,73:1 au
 * pire. `heatmap-encre.test.ts` recalcule ce plafond à partir des vraies
 * couleurs de `globals.css` et échoue si quelqu'un le relève.
 */
export const SATURATION_MAX = 0.6;

/** Le plancher : une cellule qui a des trades se voit, même à écart nul. */
export const SATURATION_MIN = 0.25;

/**
 * L'encre du chiffre écrit dans une cellule.
 *
 * ⚠️ PLEINE OPACITÉ, ET C'EST DÉLIBÉRÉ : le 0,92 d'origine coûtait cinq
 * centièmes de plafond pour rien du tout à l'œil.
 */
export const ENCRE_DE_CELLULE = "rgb(var(--foreground))";

/**
 * La courbe d'origine, bornée par `SATURATION_MAX`.
 *
 * ⚠️ La racine cubique relève vite les cellules faibles pour que le milieu de
 * l'échelle se distingue : c'est le choix d'origine, on n'y touche pas.
 */
export function opaciteBoostee(ratio: number): number {
  const borne = Math.max(0, Math.min(1, ratio));
  return SATURATION_MIN + Math.cbrt(borne) * (SATURATION_MAX - SATURATION_MIN);
}

/**
 * L'opacité du fond d'une cellule, de 0 (vide) à `SATURATION_MAX`.
 *
 * ⚠️ SORTIE À PART POUR ÊTRE MESURABLE : c'est elle, et elle seule, qui décide
 * si le chiffre écrit dessus reste lisible.
 */
export function opaciteDeCellule(cell: HeatmapCell, bounds: HeatmapBounds): number {
  if (cell.trades === 0 || cell.pnl === 0) return 0;
  const clip =
    cell.pnl > 0
      ? bounds.pClipHigh > 0
        ? bounds.pClipHigh
        : 1
      : bounds.pClipLow < 0
        ? Math.abs(bounds.pClipLow)
        : 1;
  return opaciteBoostee(Math.abs(cell.pnl) / clip);
}

/** Le fond d'une cellule, teinte comprise. Vide et neutre inclus. */
export function fondDeCellule(cell: HeatmapCell, bounds: HeatmapBounds): string {
  if (cell.trades === 0) return "rgb(var(--foreground-muted) / 0.06)";
  if (cell.pnl === 0) return "rgb(var(--foreground-muted) / 0.15)";
  const teinte = cell.pnl > 0 ? "--profit" : "--loss";
  return `rgb(var(${teinte}) / ${opaciteDeCellule(cell, bounds).toFixed(2)})`;
}
