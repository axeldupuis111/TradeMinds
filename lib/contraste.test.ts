import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TOUTE COULEUR DE TEXTE EST LISIBLE SUR LE FOND DE SON THÈME.
 *
 * ── CE QUI A ÉTÉ MESURÉ À L'ÉCRAN ───────────────────────────────────────────
 *
 * ⚠️⚠️ EN THÈME CLAIR, CELUI D'AXEL, TOUTES LES COULEURS SÉMANTIQUES
 * ÉCHOUAIENT dès qu'elles servaient de texte : accent **2,77:1** sur
 * « Compléter ma session → », or 2,94:1 sur « Premium », ambre 3,02:1, vert
 * 3,13:1 sur « +0,00 € ». Le seuil AA est 4,5:1 pour du texte courant. Et
 * `--foreground-subtle` échouait dans les DEUX thèmes : 2,43:1 en clair sur
 * les étiquettes de KPI (« Trades cette semaine »), 2,57:1 en sombre.
 *
 * ⚠️ CES COULEURS SONT PENSÉES POUR DES APLATS ET DES BORDURES, où le
 * contraste ne se joue pas de la même façon. Elles n'avaient simplement jamais
 * été mesurées en tant qu'encre. La correction ne touche donc qu'aux
 * utilitaires de TEXTE (voir `tailwind.config.ts`) : `bg-accent` garde le cyan
 * de signature.
 *
 * ── POURQUOI CE TEST EXISTE ─────────────────────────────────────────────────
 *
 * Le projet cite déjà des ratios dans ses propres commentaires (« 10,8:1 en
 * sombre mais 2,77:1 en clair »), donc la règle était connue et appliquée à la
 * main, une couleur à la fois. Ici on les calcule toutes, dans les deux thèmes,
 * à partir du CSS lui-même.
 */
describe("les encres de texte tiennent le seuil AA", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  function bloc(selecteur: string): Map<string, string> {
    const debut = css.indexOf(selecteur);
    expect(debut, `${selecteur} introuvable`).toBeGreaterThan(0);
    const ouvrante = css.indexOf("{", debut);
    const fermante = css.indexOf("\n}", ouvrante);
    const corps = css.slice(ouvrante, fermante);
    const m = new Map<string, string>();
    for (const x of Array.from(corps.matchAll(/^\s*(--[a-z-]+)\s*:\s*([^;]+);/gm))) {
      m.set(x[1], x[2].trim());
    }
    return m;
  }

  const sombre = bloc(":root {");
  const clair = bloc("html.light {");

  /** Luminance relative d'un « r g b » façon token Tailwind. */
  function luminance(token: string): number {
    const [r, g, b] = token.split(/\s+/).map(Number);
    expect([r, g, b].every((v) => Number.isFinite(v)), `token illisible : ${token}`).toBe(true);
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function ratio(encre: string, fond: string): number {
    const a = luminance(encre);
    const b = luminance(fond);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  /**
   * Les variables qui servent d'ENCRE, et rien d'autre.
   *
   * ⚠️ `--accent`, `--profit` et compagnie n'y sont PAS : ce sont des aplats.
   * Leur variante `-text` est celle que Tailwind pose sur `text-…`.
   */
  const ENCRES = [
    "--foreground",
    "--foreground-muted",
    "--foreground-subtle",
    "--muted",
    "--accent-text",
    "--profit-text",
    "--loss-text",
    "--warning-text",
    "--gold-text",
  ];

  const AA = 4.5;

  for (const [nomTheme, tokens] of [
    ["sombre", sombre],
    ["clair", clair],
  ] as const) {
    it(`chaque encre du thème ${nomTheme} passe ${AA}:1 sur son fond`, () => {
      const fond = tokens.get("--background");
      expect(fond, `--background manquant en ${nomTheme}`).toBeTruthy();
      const fautes: string[] = [];
      for (const nom of ENCRES) {
        const encre = tokens.get(nom);
        if (!encre) {
          fautes.push(`${nom} absent du thème ${nomTheme}`);
          continue;
        }
        const r = ratio(encre, fond!);
        if (r < AA) fautes.push(`${nom} : ${r.toFixed(2)}:1`);
      }
      expect(fautes, `sous le seuil AA en ${nomTheme} : ` + fautes.join(", ")).toEqual([]);
    });

    /**
     * ⚠️ ET SUR LES SURFACES, PAS SEULEMENT SUR LE FOND. Une carte pose
     * `--card`, un encart pose `--surface` : un texte lisible sur l'un peut
     * disparaître sur l'autre, et c'est là que vivent la moitié des libellés.
     */
    it(`chaque encre du thème ${nomTheme} passe ${AA}:1 sur les cartes et surfaces`, () => {
      const fautes: string[] = [];
      for (const surface of ["--card", "--surface"]) {
        const fond = tokens.get(surface);
        if (!fond) continue;
        for (const nom of ENCRES) {
          const encre = tokens.get(nom);
          if (!encre) continue;
          const r = ratio(encre, fond);
          if (r < AA) fautes.push(`${nom} sur ${surface} : ${r.toFixed(2)}:1`);
        }
      }
      expect(fautes, `sous le seuil AA en ${nomTheme} : ` + fautes.join(", ")).toEqual([]);
    });
  }

  /**
   * ⚠️ L'ENCRE POSÉE SUR UN APLAT D'ACCENT, elle, se mesure contre l'aplat.
   * Le commentaire de `--on-accent` annonce 10,8:1 en sombre et 6,8:1 en
   * clair : on vérifie que c'est encore vrai.
   */
  it("l'encre des boutons pleins tient sur l'aplat d'accent, dans les deux thèmes", () => {
    for (const [nomTheme, tokens] of [
      ["sombre", sombre],
      ["clair", clair],
    ] as const) {
      const encre = tokens.get("--on-accent") ?? sombre.get("--on-accent")!;
      const aplat = tokens.get("--accent") ?? sombre.get("--accent")!;
      expect(ratio(encre, aplat), `--on-accent sur --accent en ${nomTheme}`).toBeGreaterThanOrEqual(
        AA,
      );
    }
  });
});
