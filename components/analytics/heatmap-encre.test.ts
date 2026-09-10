import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENCRE_DE_CELLULE,
  SATURATION_MAX,
  SATURATION_MIN,
  fondDeCellule,
  opaciteBoostee,
  opaciteDeCellule,
} from "./heatmap-encre";
import type { HeatmapBounds, HeatmapCell } from "@/lib/analytics/heatmap";

/**
 * LE CHIFFRE ÉCRIT DANS UNE CELLULE DE LA HEATMAP RESTE LISIBLE.
 *
 * ── LE DÉFAUT, MESURÉ À L'ÉCRAN ─────────────────────────────────────────────
 *
 * ⚠️⚠️ « -3.0k » dans la cellule la plus rouge : **3,68:1** en thème clair, et
 * **2,22:1** en thème sombre sur la plus verte. En corps 9. Le seuil AA est
 * 4,5:1, et c'est justement la cellule qui porte le plus gros chiffre.
 *
 * ── CE QUE CE TEST TIENT, ET COMMENT ────────────────────────────────────────
 *
 * ⚠️ IL NE RECOPIE PAS LES COULEURS : il les lit dans `app/globals.css`, compose
 * la teinte sur le fond de carte comme le navigateur le fait, et calcule le
 * ratio. Changer `--profit` ou relever `SATURATION_MAX` fait échouer ce test,
 * pas un commentaire qui vieillit.
 */
describe("le chiffre d'une cellule tient le seuil AA", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  function bloc(selecteur: string): Map<string, string> {
    const debut = css.indexOf(selecteur);
    expect(debut, `${selecteur} introuvable`).toBeGreaterThan(0);
    const ouvrante = css.indexOf("{", debut);
    const fermante = css.indexOf("\n}", ouvrante);
    const m = new Map<string, string>();
    const decl = /^\s*(--[a-z-]+)\s*:\s*([^;]+);/gm;
    for (const x of Array.from(css.slice(ouvrante, fermante).matchAll(decl))) {
      m.set(x[1], x[2].trim());
    }
    return m;
  }

  type RVB = [number, number, number];

  function rvb(tokens: Map<string, string>, nom: string): RVB {
    const brut = tokens.get(nom);
    expect(brut, `${nom} absent`).toBeTruthy();
    const parts = String(brut).split(/\s+/).map(Number);
    expect(parts.length === 3 && parts.every(Number.isFinite), `${nom} illisible`).toBe(true);
    return [parts[0], parts[1], parts[2]];
  }

  function luminance([r, g, b]: RVB): number {
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function ratio(a: RVB, b: RVB): number {
    const x = luminance(a);
    const y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  /** Ce que fait le navigateur d'un `rgb(... / alpha)` posé sur un fond opaque. */
  function compose(teinte: RVB, alpha: number, fond: RVB): RVB {
    return [0, 1, 2].map((i) => teinte[i] * alpha + fond[i] * (1 - alpha)) as RVB;
  }

  const sombre = bloc(":root {");
  const clair = bloc("html.light {");

  /**
   * Les fonds sur lesquels la grille peut réellement se poser.
   *
   * ⚠️ PLUSIEURS PAR THÈME, PARCE QUE LES CARTES ONT UN DÉGRADÉ : le haut et le
   * bas d'une carte n'ont pas la même clarté, et une cellule peut se poser sur
   * l'un comme sur l'autre. On prend le pire des deux.
   */
  const FONDS = ["--card", "--surface", "--card-grad-top", "--card-grad-bot"];

  /** Le pire ratio atteignable, tous fonds et les deux teintes confondus. */
  function pireRatio(tokens: Map<string, string>, alpha: number): { r: number; ou: string } {
    const encre = rvb(tokens, "--foreground");
    let pire = Infinity;
    let ou = "";
    for (const teinteNom of ["--profit", "--loss"]) {
      for (const fondNom of FONDS) {
        const cellule = compose(rvb(tokens, teinteNom), alpha, rvb(tokens, fondNom));
        const r = ratio(encre, cellule);
        if (r < pire) {
          pire = r;
          ou = `${teinteNom} sur ${fondNom}`;
        }
      }
    }
    return { r: pire, ou };
  }

  for (const [nom, tokens] of [
    ["sombre", sombre],
    ["clair", clair],
  ] as const) {
    it(`thème ${nom} : la cellule la plus saturée reste au-dessus de 4,5:1`, () => {
      const { r, ou } = pireRatio(tokens, SATURATION_MAX);
      expect(r, `${ou} à ${SATURATION_MAX} : ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });
  }

  /**
   * ⚠️ GARDE SUR LE GARDE : sans plafond, la mesure doit ÉCHOUER. Si elle passait
   * aussi à 0,95, c'est qu'elle ne mesure rien et que le plafond ne sert à rien.
   */
  it("la saturation d'origine (0,95) échouait bel et bien", () => {
    expect(pireRatio(sombre, 0.95).r).toBeLessThan(4.5);
    expect(pireRatio(clair, 0.95).r).toBeLessThan(4.5);
  });

  it("le plafond est à peu près le plus haut qui tienne", () => {
    // Trois centièmes plus haut doit décrocher : sinon on s'est bridé pour rien.
    const auDessus = Math.round((SATURATION_MAX + 0.03) * 100) / 100;
    const marge = Math.min(pireRatio(sombre, auDessus).r, pireRatio(clair, auDessus).r);
    expect(marge, `on pourrait monter à ${auDessus}`).toBeLessThan(4.5);
  });

  describe("la courbe respecte ses bornes", () => {
    it("part du plancher et va exactement au plafond", () => {
      expect(opaciteBoostee(0)).toBeCloseTo(SATURATION_MIN, 6);
      expect(opaciteBoostee(1)).toBeCloseTo(SATURATION_MAX, 6);
    });

    it("ne dépasse jamais le plafond, même sur un ratio aberrant", () => {
      for (const r of [-3, 0.3, 0.99, 1, 4, Number.MAX_SAFE_INTEGER]) {
        const o = opaciteBoostee(r);
        expect(o, `ratio ${r} -> ${o}`).toBeLessThanOrEqual(SATURATION_MAX);
        expect(o).toBeGreaterThanOrEqual(SATURATION_MIN);
      }
    });

    it("garde l'ordre des cellules : plus de P&L, plus de couleur", () => {
      const suite = [0, 0.1, 0.25, 0.5, 0.75, 1].map(opaciteBoostee);
      for (let i = 1; i < suite.length; i++) expect(suite[i]).toBeGreaterThan(suite[i - 1]);
    });
  });

  describe("l'opacité d'une cellule", () => {
    const bornes = {
      pClipHigh: 500,
      pClipLow: -500,
      minPnl: -800,
      maxPnl: 900,
      totalTrades: 40,
    } as HeatmapBounds;
    const cellule = (pnl: number, trades = 3): HeatmapCell =>
      ({ day: 0, hour: 9, pnl, trades, winRate: 50 }) as HeatmapCell;

    it("est nulle sans trade et sans écart", () => {
      expect(opaciteDeCellule(cellule(0, 0), bornes)).toBe(0);
      expect(opaciteDeCellule(cellule(0, 5), bornes)).toBe(0);
    });

    it("plafonne au-delà du clip, dans les deux sens", () => {
      expect(opaciteDeCellule(cellule(5000), bornes)).toBeCloseTo(SATURATION_MAX, 6);
      expect(opaciteDeCellule(cellule(-5000), bornes)).toBeCloseTo(SATURATION_MAX, 6);
    });

    it("donne la même intensité pour un gain et une perte de même ampleur", () => {
      expect(opaciteDeCellule(cellule(250), bornes)).toBeCloseTo(
        opaciteDeCellule(cellule(-250), bornes),
        6,
      );
      expect(fondDeCellule(cellule(250), bornes)).toContain("--profit");
      expect(fondDeCellule(cellule(-250), bornes)).toContain("--loss");
    });
  });

  /**
   * ⚠️ LE COMPOSANT DOIT VRAIMENT S'EN SERVIR : tout ce qui précède ne prouve
   * rien si la heatmap garde sa propre copie de la courbe, ce qu'elle faisait.
   */
  describe("la heatmap n'a pas sa propre échelle", () => {
    const source = readFileSync(
      join(process.cwd(), "components/analytics/HourDayHeatmap.tsx"),
      "utf8",
    );

    it("prend son fond et son encre ici", () => {
      expect(source).toContain("fondDeCellule(cell, bounds)");
      expect(source).toContain("color: ENCRE_DE_CELLULE");
      expect(source).not.toContain("function boostedOpacity");
      expect(source).not.toContain("function cellBg");
    });

    it("ne montre pas dans sa légende une couleur absente de la grille", () => {
      // La barre de légende était figée à 0,90 alors que la grille plafonne.
      const legende = source.slice(source.indexOf("linear-gradient"), source.indexOf("linear-gradient") + 200);
      expect(legende).toContain("SATURATION_MAX");
      expect(legende).not.toContain("0.90");
    });
  });

  it("l'encre est celle du thème, à pleine opacité", () => {
    expect(ENCRE_DE_CELLULE).toBe("rgb(var(--foreground))");
  });
});
